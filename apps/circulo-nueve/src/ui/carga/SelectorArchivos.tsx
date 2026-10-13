"use client";

import { useCallback, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import {
  ACEPTA_IMAGENES,
  MAXIMO_ARCHIVOS_POR_TANDA,
  aceptaDe,
  esImagen,
  tamanoLegible,
  validarArchivo,
  type DestinoCarga,
} from "@/modulos/carga/reglas";
import { Boton } from "@/ui/componentes/Boton";

export type EstadoArchivo = "listo" | "subiendo" | "hecho" | "error";

export interface ArchivoEnCola {
  id: string;
  archivo: File;
  progreso: number;
  estado: EstadoArchivo;
  mensaje?: string;
}

export function useColaCarga(destino: DestinoCarga) {
  const [cola, setCola] = useState<ArchivoEnCola[]>([]);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const contador = useRef(0);

  const agregar = useCallback(
    (archivos: FileList | File[]) => {
      const lista = Array.from(archivos);
      const avisos: string[] = [];
      setCola((previa) => {
        // Al elegir archivos nuevos se retiran de la lista los que ya se subieron.
        const vigentes = previa.filter((a) => a.estado !== "hecho");
        const nuevos: ArchivoEnCola[] = [];
        for (const archivo of lista) {
          const motivo = validarArchivo(destino, archivo);
          if (motivo) {
            avisos.push(`${archivo.name}: ${motivo}`);
            continue;
          }
          if (vigentes.length + nuevos.length >= MAXIMO_ARCHIVOS_POR_TANDA) {
            avisos.push(`${archivo.name}: máximo ${MAXIMO_ARCHIVOS_POR_TANDA} archivos por tanda; súbelo en la siguiente.`);
            continue;
          }
          contador.current += 1;
          nuevos.push({ id: `a${contador.current}`, archivo, progreso: 0, estado: "listo" });
        }
        return [...vigentes, ...nuevos];
      });
      setRechazados(avisos);
    },
    [destino],
  );

  const quitar = useCallback((id: string) => setCola((c) => c.filter((a) => a.id !== id)), []);
  const actualizar = useCallback((id: string, cambios: Partial<ArchivoEnCola>) => {
    setCola((c) => c.map((a) => (a.id === id ? { ...a, ...cambios } : a)));
  }, []);

  return { cola, rechazados, agregar, quitar, actualizar };
}

export type ColaCarga = ReturnType<typeof useColaCarga>;

function Icono({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONO_ARCHIVO = (
  <Icono>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h4" />
  </Icono>
);
const ICONO_CAMARA = (
  <Icono>
    <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
    <circle cx="12" cy="13.5" r="3.5" />
  </Icono>
);
const ICONO_GALERIA = (
  <Icono>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Icono>
);

const NOMBRE_ESTADO: Record<EstadoArchivo, string> = {
  listo: "Listo para subir",
  subiendo: "Subiendo",
  hecho: "Subido",
  error: "No se subió",
};

export function BarraProgreso({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  const porcentaje = Math.round(Math.max(0, Math.min(1, valor)) * 100);
  return (
    <div
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={porcentaje}
      className="h-2 w-full overflow-hidden rounded-full bg-marino-100"
    >
      <div className="h-full rounded-full bg-oro-500 transition-[width] duration-200" style={{ width: `${porcentaje}%` }} />
    </div>
  );
}

interface Props {
  destino: DestinoCarga;
  cola: ColaCarga;
  ocupado: boolean;
  /** Texto bajo los botones con los tipos y tamaños aceptados. */
  nota: string;
}

/**
 * Selector de archivos pensado para teléfono, tableta y computadora: elegir
 * documentos, tomar una foto con la cámara, elegir de la galería y, en
 * computadora, arrastrar y soltar. Muestra la cola con el avance de cada archivo.
 */
export function SelectorArchivos({ destino, cola, ocupado, nota }: Props) {
  const archivos = useRef<HTMLInputElement>(null);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);

  const alElegir = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) cola.agregar(e.target.files);
    // Permite volver a elegir el mismo archivo o tomar otra foto.
    e.target.value = "";
  };
  const alSoltar = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setEncima(false);
    if (!ocupado && e.dataTransfer.files.length) cola.agregar(e.dataTransfer.files);
  };

  const total = cola.cola.length;
  const subidos = cola.cola.filter((a) => a.estado === "hecho").length;
  const avance = total ? cola.cola.reduce((s, a) => s + (a.estado === "hecho" ? 1 : a.progreso), 0) / total : 0;

  return (
    <div className="space-y-3">
      <div
        data-testid="zona-carga"
        onDragOver={(e) => {
          e.preventDefault();
          if (!ocupado) setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={alSoltar}
        className={`rounded-xl border-2 border-dashed p-4 transition-colors ${encima ? "border-oro-500 bg-oro-50" : "border-marino-300 bg-white/70"}`}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Boton
            className="w-full justify-center"
            disabled={ocupado}
            descripcion="Abre tus archivos o documentos (PDF, Word, EPUB, hojas, imágenes…). Puedes elegir varios a la vez."
            onClick={() => archivos.current?.click()}
          >
            {ICONO_ARCHIVO}
            Elegir archivos
          </Boton>
          <Boton
            variante="secundario"
            className="w-full justify-center"
            disabled={ocupado}
            descripcion="Abre la cámara del teléfono o la tableta para fotografiar una página o un documento. Repite para añadir más páginas."
            onClick={() => camara.current?.click()}
          >
            {ICONO_CAMARA}
            Tomar foto
          </Boton>
          <Boton
            variante="secundario"
            className="w-full justify-center"
            disabled={ocupado}
            descripcion="Elige una o varias fotos que ya están en la galería del teléfono o la tableta."
            onClick={() => galeria.current?.click()}
          >
            {ICONO_GALERIA}
            Galería
          </Boton>
        </div>
        <p className="mt-3 hidden text-center text-sm text-slate-600 [@media(pointer:fine)]:block">
          o arrastra y suelta los archivos aquí
        </p>
        <input ref={archivos} type="file" className="hidden" multiple accept={aceptaDe(destino)} aria-label="Archivo" data-testid="entrada-archivos" onChange={alElegir} />
        <input ref={camara} type="file" className="hidden" accept={ACEPTA_IMAGENES} capture="environment" aria-label="Foto de la cámara" data-testid="entrada-camara" onChange={alElegir} />
        <input ref={galeria} type="file" className="hidden" multiple accept={ACEPTA_IMAGENES} aria-label="Fotos de la galería" data-testid="entrada-galeria" onChange={alElegir} />
      </div>
      <p className="text-xs text-slate-600">
        {nota}
      </p>

      {cola.rechazados.length > 0 && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          <ul className="space-y-1">
            {cola.rechazados.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {total > 0 && (
        <div className="space-y-2" data-testid="cola-carga">
          {ocupado && (
            <div className="space-y-1">
              <p role="status" className="text-sm font-medium text-slate-800">
                Subiendo… {subidos} de {total} · {Math.round(avance * 100)} %
              </p>
              <BarraProgreso valor={avance} etiqueta="Avance total de la subida" />
            </div>
          )}
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white/80">
            {cola.cola.map((a) => (
              <li key={a.id} className="space-y-1.5 p-3" data-testid="archivo-en-cola">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-all text-sm font-medium text-slate-900">{a.archivo.name}</p>
                    <p className="text-xs text-slate-600">
                      {esImagen(a.archivo.name) ? "Foto o imagen" : "Documento"} · {tamanoLegible(a.archivo.size)} ·{" "}
                      <span data-testid="estado-archivo">{NOMBRE_ESTADO[a.estado]}</span>
                    </p>
                  </div>
                  {!ocupado && a.estado !== "hecho" && (
                    <Boton variante="sutil" className="shrink-0 text-sm" descripcion="Quita este archivo de la lista; no se sube." onClick={() => cola.quitar(a.id)}>
                      Quitar
                    </Boton>
                  )}
                </div>
                {(a.estado === "subiendo" || a.estado === "hecho") && <BarraProgreso valor={a.progreso} etiqueta={`Avance de ${a.archivo.name}`} />}
                {a.mensaje && <p className={`text-sm ${a.estado === "error" ? "text-red-800" : "text-emerald-800"}`}>{a.mensaje}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
