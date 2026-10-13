"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { obtenerSesion } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { detectarFormato, revisarContenidoActivo, type Formato } from "@/modulos/biblioteca/formatos";
import { REGLAS_CARGA, esImagen, extensionDe, nombreSeguro } from "@/modulos/carga/reglas";
import { consumirLimite, mensajeEspera } from "@/modulos/seguridad/limite-frecuencia";
import { z } from "@/modulos/seguridad/zod";

/** Formatos que admite el bucket privado `expedientes` (ver la migración de storage). */
const FORMATOS_EXPEDIENTE: Formato[] = ["pdf", "png", "jpeg", "webp"];
const REGLAS = REGLAS_CARGA.expediente;
const SIN_PERMISO = { ok: false, mensaje: "No tienes permiso para subir archivos a este expediente." } as const;

const esquemaPreparar = z.object({
  expedienteId: z.string().uuid(),
  nombre: z.string().trim().min(1).max(255),
  tamano: z.number().int().positive(),
});
const esquemaConfirmar = z.object({
  expedienteId: z.string().uuid(),
  ruta: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/),
  nombre: z.string().trim().min(1).max(255),
});

/** El nombre de descarga conserva la extensión del contenido guardado (.jpeg y .jpg valen igual). */
function nombreConExtension(nombre: string, ext: string): string {
  const actual = extensionDe(nombre);
  if (actual === ext || (ext === "jpg" && actual === "jpeg")) return nombre;
  return `${actual ? nombre.slice(0, -(actual.length + 1)) : nombre}.${ext}`;
}

export interface CargaPreparada {
  ok: boolean;
  mensaje?: string;
  ruta?: string;
  token?: string;
}

/** Subir y registrar documentos exige poder cargar y modificar el expediente; las cuentas cliente solo leen. */
async function puedeSubir(expedienteId: string): Promise<{ usuarioId: string } | null> {
  const sesion = await obtenerSesion();
  if (!sesion?.acceso.activo) return null;
  const supabase = await clienteSupabaseServidor();
  const [{ data: cargar }, { data: modificar }] = await Promise.all([
    supabase.rpc("has_case_perm", { case_id: expedienteId, p: "cargar" }),
    supabase.rpc("has_case_perm", { case_id: expedienteId, p: "modificar" }),
  ]);
  return cargar === true && modificar === true ? { usuarioId: sesion.usuarioId } : null;
}

/**
 * Valida permiso, tipo y tamaño y entrega una URL firmada de subida al bucket
 * privado (válida 2 h). El archivo no pasa por el servidor de la app: Vercel
 * limita el cuerpo de la petición a ~4.5 MB y una foto del teléfono suele pesar más.
 */
export async function accionPrepararCargaDocumento(expedienteId: string, nombre: string, tamano: number): Promise<CargaPreparada> {
  const datos = esquemaPreparar.safeParse({ expedienteId, nombre, tamano });
  if (!datos.success) return { ok: false, mensaje: "Datos de la subida no válidos." };
  const permiso = await puedeSubir(expedienteId);
  if (!permiso) return SIN_PERMISO;
  const limite = await consumirLimite("subirDocumento", permiso.usuarioId);
  if (!limite.permitido) return { ok: false, mensaje: mensajeEspera(limite.reintentarEnSegundos) };

  const ext = extensionDe(datos.data.nombre);
  if (!(REGLAS.extensiones as readonly string[]).includes(ext)) {
    return { ok: false, mensaje: `El tipo «.${ext}» no se admite en un expediente: sube PDF, JPG, PNG o WebP.` };
  }
  const maximo = esImagen(datos.data.nombre) ? REGLAS.bytesImagen : REGLAS.bytesMaximo;
  if (datos.data.tamano > maximo) return { ok: false, mensaje: `El archivo supera el límite de ${maximo / 1024 / 1024} MB.` };

  const ruta = `${expedienteId}/${randomUUID()}.${ext === "jpeg" ? "jpg" : ext}`;
  const { data: firmada, error } = await clienteSupabaseAdmin().storage.from("expedientes").createSignedUploadUrl(ruta);
  if (error || !firmada) return { ok: false, mensaje: "No se pudo preparar la subida. Inténtalo de nuevo." };
  return { ok: true, ruta, token: firmada.token };
}

/**
 * Comprueba el contenido real del archivo ya subido y lo registra como documento
 * del expediente. Si algo no cuadra, el archivo se borra del almacenamiento.
 */
export async function accionConfirmarCargaDocumento(expedienteId: string, ruta: string, nombre: string): Promise<{ ok: boolean; mensaje: string }> {
  const datos = esquemaConfirmar.safeParse({ expedienteId, ruta, nombre });
  if (!datos.success || !ruta.startsWith(`${expedienteId}/`)) return { ok: false, mensaje: "Datos de la subida no válidos." };
  const permiso = await puedeSubir(expedienteId);
  if (!permiso) return SIN_PERMISO;

  const almacen = clienteSupabaseAdmin().storage.from("expedientes");
  const descartar = async (mensaje: string) => {
    await almacen.remove([ruta]);
    return { ok: false, mensaje };
  };
  const { data: existente } = await clienteSupabaseAdmin().from("documents").select("id").eq("storage_path", ruta).maybeSingle();
  if (existente) return { ok: false, mensaje: "Este archivo ya está registrado." };
  const { data: blob } = await almacen.download(ruta);
  if (!blob) return { ok: false, mensaje: "No llegó el archivo al almacenamiento. Vuelve a intentarlo." };
  const bytes = new Uint8Array(await blob.arrayBuffer());

  const extRuta = extensionDe(ruta);
  const nombreFinal = nombreConExtension(nombreSeguro(nombre), extRuta);
  // La extensión de la ruta debe coincidir con el contenido real.
  const deteccion = await detectarFormato(bytes, ruta, REGLAS.bytesMaximo);
  if (!deteccion.ok) return descartar(deteccion.error);
  if (!FORMATOS_EXPEDIENTE.includes(deteccion.formato)) return descartar("En un expediente solo se guardan PDF y fotos (JPG, PNG o WebP).");
  const activo = await revisarContenidoActivo(deteccion.formato, bytes);
  if (activo.rechazar) return descartar(activo.motivos.join(" "));

  const supabase = await clienteSupabaseServidor();
  const { error } = await supabase.from("documents").insert({
    case_file_id: expedienteId,
    storage_path: ruta,
    version_plantilla: "carga-1",
    tipo: "adjunto",
    nombre: nombreFinal,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    tamano_bytes: bytes.byteLength,
    created_by: permiso.usuarioId,
  });
  if (error) return descartar(error.code === "42501" ? SIN_PERMISO.mensaje : "No se pudo registrar el documento. Inténtalo de nuevo.");
  revalidatePath(`/expedientes/${expedienteId}`);
  return { ok: true, mensaje: `«${nombreFinal}» guardado en «Documentos».` };
}

/** La subida desde el navegador falló a medias: borra lo que haya llegado sin registrar. */
export async function accionCancelarCargaDocumento(expedienteId: string, ruta: string): Promise<void> {
  const datos = esquemaConfirmar.safeParse({ expedienteId, ruta, nombre: "x" });
  if (!datos.success || !ruta.startsWith(`${expedienteId}/`) || !(await puedeSubir(expedienteId))) return;
  const { data: registrado } = await clienteSupabaseAdmin().from("documents").select("id").eq("storage_path", ruta).maybeSingle();
  if (!registrado) await clienteSupabaseAdmin().storage.from("expedientes").remove([ruta]);
}
