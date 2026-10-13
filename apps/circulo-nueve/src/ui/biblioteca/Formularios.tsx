"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, type FormEvent } from "react";
import {
  accionActualizarWeb,
  accionAgregarWeb,
  accionAprobarVersion,
  accionCancelarCargaDirecta,
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
import { Boton } from "@/ui/componentes/Boton";
import { SelectorArchivos, useColaCarga } from "@/ui/carga/SelectorArchivos";
import { aceptaDe, tituloParaArchivo } from "@/modulos/carga/reglas";
import { subirConProgreso } from "@/modulos/carga/subir-firmado";
import { Casilla, Selector } from "@/ui/expedientes/Selector";

const ACEPTA = aceptaDe("biblioteca");

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

function CamposMetadatos({
  estado,
  valores: base = {},
  conDerechos = true,
  tituloOpcional = false,
}: {
  estado: EstadoFormulario;
  valores?: ValoresFuente;
  conDerechos?: boolean;
  tituloOpcional?: boolean;
}) {
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
        <Campo
          etiqueta="Título"
          name="titulo"
          defaultValue={valores.titulo}
          required={!tituloOpcional}
          maxLength={280}
          error={e.titulo}
          nota={tituloOpcional ? "Si lo dejas vacío se usa el nombre de cada archivo. Con varios archivos se numeran: «Título (1 de 3)»." : undefined}
        />
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
  const cola = useColaCarga("biblioteca");
  const [estado, setEstado] = useState<EstadoFormulario>(ESTADO_INICIAL);
  const [subiendo, setSubiendo] = useState(false);
  const router = useRouter();
  const pendientes = cola.cola.filter((a) => a.estado === "listo" || a.estado === "error");

  // Cada archivo es una fuente con los mismos metadatos. Todos van directo a la
  // cuarentena con una URL firmada (Vercel limita el cuerpo a ~4.5 MB) y el
  // servidor comprueba el formato real antes de crear el trabajo de ingesta.
  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendientes.length) return setEstado({ errores: { archivo: "Elige al menos un archivo o toma una foto." } });
    const base = new FormData(e.currentTarget);
    const titulo = String(base.get("titulo") ?? "");
    setSubiendo(true);
    setEstado(ESTADO_INICIAL);
    let correctos = 0;
    try {
      for (const [i, item] of pendientes.entries()) {
        cola.actualizar(item.id, { estado: "subiendo", progreso: 0, mensaje: undefined });
        const datos = new FormData();
        for (const [clave, valor] of base.entries()) datos.append(clave, valor);
        datos.set("titulo", tituloParaArchivo(titulo, item.archivo.name, i, pendientes.length));
        datos.set("nombreArchivo", item.archivo.name);
        datos.set("tamanoArchivo", String(item.archivo.size));
        const preparada = await accionPrepararCargaDirecta(datos);
        if (!preparada.ok || !preparada.ruta || !preparada.token || !preparada.fuenteId) {
          const motivo = preparada.errores?.archivo ?? preparada.mensaje;
          cola.actualizar(item.id, { estado: "error", progreso: 0, mensaje: motivo ?? "Revisa los datos marcados en el formulario." });
          // Un error de metadatos afecta a toda la tanda: se corrige y se vuelve a intentar.
          if (preparada.errores && !preparada.errores.archivo) {
            setEstado({ errores: preparada.errores });
            return;
          }
          continue;
        }
        const subida = await subirConProgreso(
          { supabaseUrl, clavePublica, bucket: "cuarentena", ruta: preparada.ruta, token: preparada.token },
          item.archivo,
          (fraccion) => cola.actualizar(item.id, { progreso: fraccion }),
        );
        if (!subida.ok) {
          await accionCancelarCargaDirecta(preparada.fuenteId, subida.mensaje ?? "error de red");
          cola.actualizar(item.id, { estado: "error", mensaje: `No se pudo subir: ${subida.mensaje}` });
          continue;
        }
        const confirmada = await accionConfirmarCargaDirecta(preparada.fuenteId, item.archivo.name);
        if (confirmada.ok) correctos += 1;
        cola.actualizar(item.id, {
          estado: confirmada.ok ? "hecho" : "error",
          mensaje: confirmada.ok ? confirmada.mensaje : (confirmada.errores?.archivo ?? confirmada.mensaje),
        });
      }
      const fallidos = pendientes.length - correctos;
      setEstado(
        fallidos
          ? { mensaje: `Subidos ${correctos} de ${pendientes.length}. ${fallidos === 1 ? "Un archivo no se pudo subir" : `${fallidos} archivos no se pudieron subir`}: revisa el motivo en la lista.` }
          : { ok: true, mensaje: `Listo: ${correctos} de ${pendientes.length} en cuarentena. Pulsa «Procesar pendientes ahora» o espera al procesamiento automático; las fotos pasan por OCR.` },
      );
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <form onSubmit={alEnviar} className="space-y-4" noValidate>
      <SelectorArchivos
        destino="biblioteca"
        cola={cola}
        ocupado={subiendo}
        nota="Documentos (PDF, también escaneados, EPUB, DOCX, TXT, Markdown), hojas (CSV, XLSX, ODS), presentaciones (PPTX), fotos o imágenes (JPG, PNG, WebP; pasan por OCR), audio (MP3, WAV, OGG, M4A) y video (MP4, WebM). Hasta 50 MB por archivo y 10 MB por foto; hasta 20 archivos por tanda. Se comprueba el formato real y se rechazan macros y contenido activo."
      />
      {estado.errores?.archivo && <p className="text-sm text-red-700">{estado.errores.archivo}</p>}
      <CamposMetadatos estado={estado} tituloOpcional />
      <MensajeFormulario estado={estado} />
      <Boton
        type="submit"
        disabled={subiendo}
        aria-busy={subiendo || undefined}
        descripcion="Sube los archivos elegidos, comprueba cada uno y lo deja en cuarentena con un trabajo de ingesta pendiente. Nada se indexa sin tu revisión."
      >
        {subiendo ? "Subiendo…" : "Cargar a cuarentena"}
      </Boton>
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
        Trabajos pendientes: <strong data-testid="pendientes">{pendientes}</strong>. El worker los procesa solo, cada 15 minutos aproximadamente
        (los escaneados con OCR, el audio y el video, únicamente él). Con el botón, los textos, EPUB, DOCX, PDF con texto y páginas web se procesan al momento.
      </p>
      <BotonEnviar variante="secundario" descripcion="Procesa ahora en este servidor hasta 5 trabajos pendientes: extracción o cálculo de vectores. Puede tardar un par de minutos.">
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
