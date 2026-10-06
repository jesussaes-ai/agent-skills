import "server-only";
import type { ResultadoNumerologia } from "@/modulos/calculo/numerologia";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { esAdmin, type Sesion } from "@/modulos/auth/sesion";
import { PERMISOS_EXPEDIENTE, type PermisoExpediente } from "./esquemas";

export interface ResumenExpediente {
  id: string;
  etiqueta: string;
  estado: string;
  esDemo: boolean;
  creado: string;
  esPropio: boolean;
  esCliente: boolean;
}

export interface Lectura {
  id: string;
  sistema: string;
  creada: string;
  motor: string;
  motorVersion: string;
  reglasVersion: string;
  resultado: ResultadoNumerologia;
}

export interface Documento {
  id: string;
  nombre: string;
  creado: string;
  retenerHasta: string | null;
  tamanoBytes: number | null;
  lecturaId: string | null;
}

export interface Consentimiento {
  tipo: string;
  otorgado: boolean;
  fecha: string;
}

export interface Asignacion {
  usuarioId: string;
  nombre: string;
  permisos: string[];
  vence: string | null;
  documentoId?: string;
}

export interface Persona {
  id: string;
  nombre: string;
  roles: string[];
}

export interface EventoAuditoria {
  accion: string;
  recurso: string;
  fecha: string;
  actor: string;
}

export interface DetalleExpediente {
  expediente: ResumenExpediente & { clienteId: string | null };
  permisos: Record<PermisoExpediente, boolean>;
  perfil: {
    nombreNacimiento: string;
    nombrePreferido: string;
    fecha: string;
    hora: string;
    precisionHora: "exacta" | "aproximada" | "desconocida";
    lugar: string;
    zonaHoraria: string;
  } | null;
  consentimientos: Record<string, Consentimiento | undefined>;
  lecturas: Lectura[];
  documentos: Documento[];
  administracion: {
    asignaciones: Asignacion[];
    asignacionesArchivo: Asignacion[];
    personas: Persona[];
    auditoria: EventoAuditoria[];
  } | null;
}

export async function listarExpedientes(sesion: Sesion): Promise<ResumenExpediente[]> {
  const supabase = await clienteSupabaseServidor();
  const { data } = await supabase
    .from("case_files")
    .select("id, display_label, status, es_demo, created_at, created_by, client_user_id")
    .order("created_at", { ascending: false });
  return (data ?? []).map((c) => ({
    id: c.id,
    etiqueta: c.display_label,
    estado: c.status,
    esDemo: c.es_demo,
    creado: c.created_at,
    esPropio: c.created_by === sesion.usuarioId,
    esCliente: c.client_user_id === sesion.usuarioId,
  }));
}

export async function permisosSobre(expedienteId: string): Promise<Record<PermisoExpediente, boolean>> {
  const supabase = await clienteSupabaseServidor();
  const resultados = await Promise.all(
    PERMISOS_EXPEDIENTE.map((p) => supabase.rpc("has_case_perm", { case_id: expedienteId, p })),
  );
  return Object.fromEntries(PERMISOS_EXPEDIENTE.map((p, i) => [p, resultados[i].data === true])) as Record<
    PermisoExpediente,
    boolean
  >;
}

/** Devuelve null si el expediente no existe o la persona no puede listarlo (sin distinguir). */
export async function obtenerExpediente(sesion: Sesion, id: string): Promise<DetalleExpediente | null> {
  const supabase = await clienteSupabaseServidor();
  const { data: c } = await supabase
    .from("case_files")
    .select("id, display_label, status, es_demo, created_at, created_by, client_user_id")
    .eq("id", id)
    .maybeSingle();
  if (!c) return null;

  const [permisos, perfil, consentimientos, lecturas, documentos] = await Promise.all([
    permisosSobre(id),
    supabase.from("birth_profiles").select("*").eq("case_file_id", id).maybeSingle(),
    supabase.from("consents").select("tipo, otorgado, otorgado_at, secuencia").eq("case_file_id", id).order("secuencia"),
    supabase
      .from("readings")
      .select("id, sistema, created_at, motor, motor_version, reglas_version, resultado_calculado")
      .eq("case_file_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("id, nombre, created_at, retener_hasta, tamano_bytes, reading_id")
      .eq("case_file_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const vigentes: Record<string, Consentimiento | undefined> = {};
  for (const r of consentimientos.data ?? []) vigentes[r.tipo] = { tipo: r.tipo, otorgado: r.otorgado, fecha: r.otorgado_at };

  const p = perfil.data;
  const detalle: DetalleExpediente = {
    expediente: {
      id: c.id,
      etiqueta: c.display_label,
      estado: c.status,
      esDemo: c.es_demo,
      creado: c.created_at,
      esPropio: c.created_by === sesion.usuarioId,
      esCliente: c.client_user_id === sesion.usuarioId,
      clienteId: c.client_user_id,
    },
    permisos,
    perfil: p
      ? {
          nombreNacimiento: p.birth_name ?? "",
          nombrePreferido: p.preferred_name ?? "",
          fecha: p.birth_date ?? "",
          hora: p.birth_time ? String(p.birth_time).slice(0, 5) : "",
          precisionHora: p.birth_time_precision,
          lugar: p.birth_place ?? "",
          zonaHoraria: p.tz_id ?? "",
        }
      : null,
    consentimientos: vigentes,
    lecturas: (lecturas.data ?? []).map((l) => ({
      id: l.id,
      sistema: l.sistema,
      creada: l.created_at,
      motor: l.motor,
      motorVersion: l.motor_version,
      reglasVersion: l.reglas_version,
      resultado: l.resultado_calculado as ResultadoNumerologia,
    })),
    documentos: (documentos.data ?? []).map((d) => ({
      id: d.id,
      nombre: d.nombre ?? "reporte.pdf",
      creado: d.created_at,
      retenerHasta: d.retener_hasta,
      tamanoBytes: d.tamano_bytes,
      lecturaId: d.reading_id,
    })),
    administracion: null,
  };

  if (esAdmin(sesion) && sesion.acceso.aal2) detalle.administracion = await datosAdministracion(id);
  return detalle;
}

async function datosAdministracion(id: string): Promise<NonNullable<DetalleExpediente["administracion"]>> {
  const supabase = await clienteSupabaseServidor();
  const [perfiles, roles, asignaciones, asignacionesArchivo, auditoria] = await Promise.all([
    supabase.from("user_profiles").select("user_id, display_name, status").eq("status", "activo").order("display_name"),
    supabase.from("user_roles").select("user_id, role_id"),
    supabase.from("case_file_grants").select("user_id, permissions, expires_at").eq("case_file_id", id),
    supabase.from("document_grants").select("document_id, user_id, expires_at, documents!inner(case_file_id)").eq("documents.case_file_id", id),
    supabase
      .from("audit_log")
      .select("accion, recurso_tipo, created_at, actor_id")
      .eq("expediente_id", id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  const nombre = new Map((perfiles.data ?? []).map((p) => [p.user_id, p.display_name]));
  const personas: Persona[] = (perfiles.data ?? []).map((p) => ({
    id: p.user_id,
    nombre: p.display_name,
    roles: (roles.data ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.role_id),
  }));
  return {
    personas,
    asignaciones: (asignaciones.data ?? []).map((a) => ({
      usuarioId: a.user_id,
      nombre: nombre.get(a.user_id) ?? "Cuenta no activa",
      permisos: a.permissions,
      vence: a.expires_at,
    })),
    asignacionesArchivo: (asignacionesArchivo.data ?? []).map((a) => ({
      usuarioId: a.user_id,
      nombre: nombre.get(a.user_id) ?? "Cuenta no activa",
      permisos: ["abrir_descargar"],
      vence: a.expires_at,
      documentoId: a.document_id,
    })),
    auditoria: (auditoria.data ?? []).map((e) => ({
      accion: e.accion,
      recurso: e.recurso_tipo,
      fecha: e.created_at,
      actor: e.actor_id ? (nombre.get(e.actor_id) ?? "Cuenta") : "Sistema",
    })),
  };
}

export async function leerAjustes() {
  const supabase = await clienteSupabaseServidor();
  const [{ data: ajustes }, { data: aviso }] = await Promise.all([
    supabase.from("app_settings").select("retencion_documentos_dias, vigencia_url_firmada_segundos").single(),
    supabase.from("privacy_notice_settings").select("responsable, finalidades, datos_tratados, conservacion, derechos, contacto").single(),
  ]);
  return {
    retencionDias: ajustes?.retencion_documentos_dias ?? 365,
    vigenciaSegundos: ajustes?.vigencia_url_firmada_segundos ?? 60,
    aviso: aviso ?? {},
  };
}

/** Borra del almacenamiento todos los archivos bajo la carpeta del expediente. */
export async function borrarArchivosDeExpediente(expedienteId: string): Promise<void> {
  const almacen = clienteSupabaseAdmin().storage.from("expedientes");
  const { data } = await almacen.list(expedienteId, { limit: 1000 });
  const rutas = (data ?? []).map((o) => `${expedienteId}/${o.name}`);
  if (rutas.length) await almacen.remove(rutas);
}
