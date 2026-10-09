"use client";

import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { useActionState, useState, type FormEvent } from "react";
import {
  accionActualizarWeb,
  accionAgregarWeb,
  accionAprobarVersion,
  accionCargarArchivo,
  accionConfirmarCargaDirecta,
  accionCorregirFigura,
  accionEditarFuente,
  accionPrepararCargaDirecta,
  accionExcluirFragmento,
  accionProcesarPendientes,
  accionRechazarVersion,
  accionReemplazarArchivo,
  accionRetirarFuente,
} from "@/modulos/biblioteca/acciones";
import { GRUPOS, NIVELES_ACCESO } from "@/modulos/biblioteca/esquemas";
import type { EstadoFormulario } from "@/modulos/auth/esquemas";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Casilla, Selector } from "@/ui/expedientes/Selector";

const ACEPTA = ".pdf,.epub,.docx,.txt,.md,.markdown,.csv,.xlsx,.ods,.pptx,.png,.jpg,.jpeg,.webp,.mp3,.wav,.ogg,.oga,.opus,.m4a,.mp4,.m4v,.webm";
/** Por encima de este tamaño se sube directo a Storage (Vercel limita el cuerpo de la petición a ~4.5 MB). */
const UMBRAL_CARGA_DIRECTA = 4 * 1024 * 1024;

export interface ValoresFuente {
  titulo?: string;
  autor?: string | null;
  referencia?: string;
  edicion?: string | null;
  idioma?: string;
  tradicion?: string | null;
  grupo?: string;
  licencia?: string;
  notasDerechos?: string | null;
  nivelAcceso?: string;
  esDemo?: boolean;
}

function CamposMetadatos({ estado, valores: base = {}, conDerechos = true }: { estado: EstadoFormulario; valores?: ValoresFuente; conDerechos?: boolean }) {
  const e = estado.errores ?? {};
  // Tras un error, React vacía el formulario: se vuelven a mostrar los valores enviados.
  const enviados = estado.valores;
  const valores: ValoresFuente = enviados
    ? {
        ...base,
        titulo: enviados.titulo,
        autor: enviados.autor,
        referencia: enviados.referencia,
        edicion: enviados.edicion,
        idioma: enviados.idioma,
        tradicion: enviados.tradicion,
        grupo: enviados.grupo,
        licencia: enviados.licencia,
        notasDerechos: enviados.notasDerechos,
        nivelAcceso: enviados.nivelAcceso,
        esDemo: enviados.esDemo === "on",
      }
    : base;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Título" name="titulo" defaultValue={valores.titulo} required maxLength={300} error={e.titulo} />
        <Campo etiqueta="Autoría (persona u organización)" name="autor" defaultValue={valores.autor ?? ""} maxLength={200} />
        <Campo
          etiqueta="Referencia"
          name="referencia"
          defaultValue={valores.referencia}
          required
          maxLength={500}
          error={e.referencia}
          nota="Editorial y año, archivo de la persona propietaria o URL. Se cita tal cual."
        />
        <Campo etiqueta="Edición" name="edicion" defaultValue={valores.edicion ?? ""} maxLength={120} />
        <Campo etiqueta="Idioma (código)" name="idioma" defaultValue={valores.idioma ?? "es"} maxLength={10} />
        <Campo etiqueta="Tradición o escuela" name="tradicion" defaultValue={valores.tradicion ?? ""} maxLength={120} />
        <Selector etiqueta="Grupo" name="grupo" defaultValue={valores.grupo ?? "aportada"} opciones={GRUPOS} />
        <Selector etiqueta="Quién puede consultarla" name="nivelAcceso" defaultValue={valores.nivelAcceso ?? "consultores"} opciones={NIVELES_ACCESO} />
        <Campo
          etiqueta="Licencia o permiso de uso"
          name="licencia"
          defaultValue={valores.licencia}
          required
          maxLength={300}
          error={e.licencia}
          nota="P. ej. «Dominio público», «CC BY 4.0», «Autorización escrita del autor»."
        />
        <Campo etiqueta="Notas de derechos (opcional)" name="notasDerechos" defaultValue={valores.notasDerechos ?? ""} maxLength={1000} />
      </div>
      <Casilla etiqueta="Es un documento ficticio de demostración" name="esDemo" defaultChecked={valores.esDemo} />
      {conDerechos && (
        <div>
          <Casilla etiqueta="Confirmo que tengo derecho a usar esta fuente y que no se elude ningún DRM, muro de pago o inicio de sesión." name="derechos" />
          {e.derechos && <p className="ml-8 text-sm text-red-700">{e.derechos}</p>}
        </div>
      )}
    </>
  );
}

export function FormularioCarga({ supabaseUrl, clavePublica }: { supabaseUrl: string; clavePublica: string }) {
  const [estadoServidor, accion] = useActionState(accionCargarArchivo, ESTADO_INICIAL);
  const [estadoDirecto, setEstadoDirecto] = useState<EstadoFormulario | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const router = useRouter();
  const estado = estadoDirecto ?? estadoServidor;

  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    const formulario = e.currentTarget;
    const archivo = (formulario.elements.namedItem("archivo") as HTMLInputElement | null)?.files?.[0];
    if (!archivo || archivo.size <= UMBRAL_CARGA_DIRECTA) {
      setEstadoDirecto(null);
      return;
    }
    // Archivo grande: no pasa por el servidor de la app; va directo a la cuarentena con URL firmada.
    e.preventDefault();
    setSubiendo(true);
    try {
      const datos = new FormData(formulario);
      datos.delete("archivo");
      datos.set("nombreArchivo", archivo.name);
      datos.set("tamanoArchivo", String(archivo.size));
      const preparada = await accionPrepararCargaDirecta(datos);
      if (!preparada.ok || !preparada.ruta || !preparada.token || !preparada.fuenteId) return setEstadoDirecto(preparada);
      const { error } = await createClient(supabaseUrl, clavePublica)
        .storage.from("cuarentena")
        .uploadToSignedUrl(preparada.ruta, preparada.token, archivo, { contentType: archivo.type || "application/octet-stream" });
      if (error) return setEstadoDirecto({ mensaje: `No se pudo subir el archivo: ${error.message}` });
      setEstadoDirecto(await accionConfirmarCargaDirecta(preparada.fuenteId, archivo.name));
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <form action={accion} onSubmit={alEnviar} className="space-y-4" noValidate>
      <Campo
        etiqueta="Archivo"
        name="archivo"
        type="file"
        accept={ACEPTA}
        required
        error={estado.errores?.archivo}
        nota="Documentos (PDF con figuras, EPUB, DOCX, TXT, Markdown), hojas (CSV, XLSX, ODS), presentaciones (PPTX), imágenes con OCR y audio o video con transcripción local. Hasta 25 MB; por encima de 4 MB se sube directo a Storage (hasta 50 MB). Se comprueba el formato real y se rechazan macros y contenido activo."
      />
      {estado.valores && <p className="text-xs text-slate-600">Se conservaron los datos escritos; vuelve a elegir el archivo.</p>}
      <CamposMetadatos estado={estado} />
      <MensajeFormulario estado={estado} />
      {subiendo && <p role="status" className="text-sm text-slate-700">Subiendo directamente a Storage…</p>}
      <BotonEnviar descripcion="Comprueba el archivo, lo deja en cuarentena y crea un trabajo de ingesta pendiente. Nada se indexa sin tu revisión.">
        Cargar a cuarentena
      </BotonEnviar>
    </form>
  );
}

export function FormularioWeb() {
  const [estado, accion] = useActionState(accionAgregarWeb, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <Campo etiqueta="Dirección de la página" name="url" type="url" required maxLength={2000} error={estado.errores?.url} nota="Solo páginas públicas. Se respeta robots.txt y no se superan muros de pago ni inicios de sesión." />
      <CamposMetadatos estado={estado} />
      <MensajeFormulario estado={estado} />
      <BotonEnviar descripcion="Crea un trabajo que descargará la página, extraerá el contenido principal a Markdown y lo dejará para revisión.">
        Añadir página web
      </BotonEnviar>
    </form>
  );
}

export function BotonProcesar({ pendientes }: { pendientes: number }) {
  const [estado, accion] = useActionState(accionProcesarPendientes, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-3">
      <p className="text-sm text-slate-700">
        Trabajos pendientes: <strong data-testid="pendientes">{pendientes}</strong>. En producción los procesa el worker (<code>npm run ingesta:worker</code>).
      </p>
      <BotonEnviar variante="secundario" descripcion="Procesa ahora en este servidor hasta 5 trabajos pendientes: extracción o cálculo de vectores. Puede tardar.">
        Procesar pendientes ahora
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}

export function FormularioEditarFuente({ fuenteId, valores }: { fuenteId: string; valores: ValoresFuente }) {
  const [estado, accion] = useActionState(accionEditarFuente, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <input type="hidden" name="fuenteId" value={fuenteId} />
      <CamposMetadatos estado={estado} valores={valores} conDerechos={false} />
      <MensajeFormulario estado={estado} />
      <BotonEnviar variante="secundario" descripcion="Guarda los metadatos y derechos de la fuente.">Guardar metadatos</BotonEnviar>
    </form>
  );
}

export function BotonFragmento({ fuenteId, fragmentoId, excluido }: { fuenteId: string; fragmentoId: string; excluido: boolean }) {
  const [estado, accion] = useActionState(accionExcluirFragmento, ESTADO_INICIAL);
  return (
    <form action={accion}>
      <input type="hidden" name="fuenteId" value={fuenteId} />
      <input type="hidden" name="fragmentoId" value={fragmentoId} />
      <input type="hidden" name="excluir" value={excluido ? "0" : "1"} />
      <BotonEnviar variante="sutil" className="text-sm" descripcion={excluido ? "Vuelve a incluir este fragmento en el índice." : "Excluye este fragmento: no se indexará ni aparecerá en respuestas."}>
        {excluido ? "Incluir" : "Excluir"}
      </BotonEnviar>
      {!estado.ok && <MensajeFormulario estado={estado} />}
    </form>
  );
}

export function DecisionVersion({ fuenteId, versionId }: { fuenteId: string; versionId: string }) {
  const [estadoA, aprobar] = useActionState(accionAprobarVersion, ESTADO_INICIAL);
  const [estadoR, rechazar] = useActionState(accionRechazarVersion, ESTADO_INICIAL);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-3">
        <form action={aprobar}>
          <input type="hidden" name="fuenteId" value={fuenteId} />
          <input type="hidden" name="versionId" value={versionId} />
          <BotonEnviar descripcion="Aprueba esta versión: se calculan los vectores de los fragmentos no excluidos y pasa a ser la versión consultable.">
            Aprobar e indexar
          </BotonEnviar>
        </form>
        <form action={rechazar}>
          <input type="hidden" name="fuenteId" value={fuenteId} />
          <input type="hidden" name="versionId" value={versionId} />
          <BotonEnviar variante="secundario" descripcion="Rechaza y elimina esta versión y sus archivos derivados. La versión vigente, si existe, se mantiene.">
            Rechazar versión
          </BotonEnviar>
        </form>
      </div>
      <MensajeFormulario estado={estadoA} />
      <MensajeFormulario estado={estadoR} />
    </div>
  );
}

export function ActualizarFuente({ fuenteId, origen }: { fuenteId: string; origen: string }) {
  const [estadoW, actualizar] = useActionState(accionActualizarWeb, ESTADO_INICIAL);
  const [estadoA, reemplazar] = useActionState(accionReemplazarArchivo, ESTADO_INICIAL);
  if (origen === "web") {
    return (
      <form action={actualizar} className="space-y-2">
        <input type="hidden" name="fuenteId" value={fuenteId} />
        <BotonEnviar variante="secundario" descripcion="Vuelve a descargar la página. Si cambió, se crea una versión nueva con las diferencias para revisar; nunca se reemplaza en silencio.">
          Actualizar desde la web
        </BotonEnviar>
        <MensajeFormulario estado={estadoW} />
      </form>
    );
  }
  return (
    <form action={reemplazar} className="space-y-3" noValidate>
      <input type="hidden" name="fuenteId" value={fuenteId} />
      <Campo etiqueta="Archivo de la versión nueva" name="archivo" type="file" accept={ACEPTA} error={estadoA.errores?.archivo} />
      <BotonEnviar variante="secundario" descripcion="Sube otro archivo para esta fuente. Se crea una versión nueva con las diferencias para revisar.">
        Cargar versión nueva
      </BotonEnviar>
      <MensajeFormulario estado={estadoA} />
    </form>
  );
}

export function CorreccionFigura({ fuenteId, figuraId, correccion }: { fuenteId: string; figuraId: string; correccion: string | null }) {
  const [estado, accion] = useActionState(accionCorregirFigura, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-2" noValidate>
      <input type="hidden" name="fuenteId" value={fuenteId} />
      <input type="hidden" name="figuraId" value={figuraId} />
      <Campo etiqueta="Corrección de la descripción (administración)" name="correccion" defaultValue={correccion ?? ""} maxLength={2000} />
      <BotonEnviar variante="secundario" className="text-sm" descripcion="Guarda una descripción corregida a mano. La imagen sigue siendo la fuente de verdad; la descripción generada se conserva.">
        Guardar corrección
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}

export function RetirarFuente({ fuenteId }: { fuenteId: string }) {
  const [estado, accion] = useActionState(accionRetirarFuente, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-3" noValidate>
      <input type="hidden" name="fuenteId" value={fuenteId} />
      <Campo
        etiqueta="Escribe RETIRAR para confirmar"
        name="confirmacion"
        autoComplete="off"
        error={estado.errores?.confirmacion}
        nota="Se borran el original, el Markdown, los fragmentos y los vectores. Se conservan los metadatos con estado «retirado» para la auditoría."
      />
      <MensajeFormulario estado={estado} />
      <BotonEnviar variante="secundario" className="border-red-300 text-red-800 hover:bg-red-50" descripcion="Retira la fuente: deja de consultarse y se borran sus archivos y fragmentos.">
        Retirar fuente
      </BotonEnviar>
    </form>
  );
}
