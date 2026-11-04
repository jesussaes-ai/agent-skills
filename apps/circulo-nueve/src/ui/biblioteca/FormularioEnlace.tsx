"use client";

import { useActionState, useState } from "react";
import { accionAgregarEnlace, accionRevisarEnlace, type VistaEnlace } from "@/modulos/biblioteca/acciones-enlaces";
import { GRUPOS } from "@/modulos/biblioteca/esquemas";
import { BotonEnviar, Campo } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { Casilla, Selector } from "@/ui/expedientes/Selector";

const INICIAL: VistaEnlace = { estado: "inicial" };

const NOMBRE_TIPO: Record<string, string> = {
  "youtube-video": "Video de YouTube: se usarán sus subtítulos o, si no tiene, se transcribirá el audio.",
  "youtube-lista": "Lista o canal de YouTube: cada video (hasta 300) será una fuente con su transcripción.",
  "podcast-rss": "Podcast",
  audio: "Audio por enlace: se descargará y se transcribirá.",
  web: "Página web: se guardará su texto principal en Markdown.",
};

function duracion(segundos: number | null) {
  if (!segundos) return "";
  const h = Math.floor(segundos / 3600);
  const m = Math.round((segundos % 3600) / 60);
  return h ? ` · ${h} h ${m} min` : ` · ${m} min`;
}

/**
 * «Pegar un enlace»: YouTube (video, lista o canal), podcast (RSS o Apple Podcasts),
 * audio directo o página web. Primero se revisa qué es; luego se agrega a la cola.
 */
export function FormularioEnlace() {
  const [vista, revisar] = useActionState(accionRevisarEnlace, INICIAL);
  const [resultado, agregar] = useActionState(accionAgregarEnlace, INICIAL);
  const [todos, setTodos] = useState<boolean | null>(null);
  const listo = vista.estado === "listo" || vista.estado === "podcast";

  return (
    <div className="space-y-4">
      <form action={revisar} className="space-y-3" noValidate>
        <Campo
          etiqueta="Enlace"
          name="url"
          type="url"
          required
          maxLength={2000}
          placeholder="https://www.youtube.com/watch?v=…  ·  podcast  ·  página web"
          nota="Pega un video, lista o canal de YouTube, un podcast (su RSS o su página de Apple Podcasts), un audio (MP3, M4A…) o una página web."
        />
        <BotonEnviar variante="secundario" descripcion="Revisa qué tipo de enlace es. Si es un podcast, muestra sus episodios para que elijas cuáles agregar.">
          Revisar enlace
        </BotonEnviar>
      </form>

      {vista.estado === "error" && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
          {vista.mensaje}
        </p>
      )}

      {listo && vista.url && (
        <form action={agregar} className="space-y-4 rounded-xl border border-slate-200 p-4" noValidate key={vista.url}>
          <input type="hidden" name="url" value={vista.url} />
          <p className="text-sm text-slate-800" data-testid="tipo-enlace">
            <strong>{vista.podcast ? vista.podcast.titulo : NOMBRE_TIPO[vista.tipo ?? "web"]}</strong>
            {vista.podcast?.autor ? ` · ${vista.podcast.autor}` : ""}
          </p>

          {vista.podcast && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-900">
                Episodios ({vista.podcast.episodios.length}). Marca los que quieras transcribir:
              </legend>
              <div className="flex flex-wrap gap-2">
                <Boton variante="sutil" className="text-sm" descripcion="Marca todos los episodios de la lista." onClick={() => setTodos(true)}>
                  Marcar todos
                </Boton>
                <Boton variante="sutil" className="text-sm" descripcion="Quita la marca de todos los episodios." onClick={() => setTodos(false)}>
                  Quitar todos
                </Boton>
              </div>
              <ul className="max-h-80 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
                {vista.podcast.episodios.map((ep, i) => (
                  <li key={`${ep.audio}-${todos}`}>
                    <label className="flex cursor-pointer items-start gap-2 rounded p-1 text-sm hover:bg-slate-50">
                      <input
                        type="checkbox"
                        name="episodio"
                        value={ep.audio}
                        defaultChecked={todos ?? i < 5}
                        className="mt-1 h-4 w-4 shrink-0"
                      />
                      <span>
                        <span className="text-slate-900">{ep.titulo}</span>
                        <span className="block text-xs text-slate-600">
                          {ep.fecha ?? "sin fecha"}
                          {duracion(ep.duracionSegundos)}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {!vista.podcast && vista.tipo !== "youtube-lista" && (
              <Campo etiqueta="Título (opcional)" name="titulo" maxLength={300} nota="Vacío: se usa el título del video, del audio o de la página." />
            )}
            <Campo etiqueta="Autoría (opcional)" name="autor" maxLength={200} />
            <Selector etiqueta="Grupo" name="grupo" defaultValue="aportada" opciones={GRUPOS} />
            <Campo etiqueta="Tradición o tema (opcional)" name="tradicion" maxLength={120} />
          </div>
          <Casilla etiqueta="Aprobar e indexar automáticamente (recomendado)" name="aprobarAutomatico" defaultChecked />
          <Casilla etiqueta="Confirmo que puedo usar este material para mi consulta personal (sin eludir muros de pago ni inicios de sesión)." name="derechos" />
          <BotonEnviar descripcion="Agrega el enlace a la cola. La DGX Spark descarga los subtítulos o el audio, lo transcribe con marcas de tiempo y lo indexa.">
            Agregar a la biblioteca
          </BotonEnviar>
        </form>
      )}

      {resultado.mensaje && (
        <p role={resultado.estado === "error" ? "alert" : "status"} className={`rounded-lg p-3 text-sm ${resultado.estado === "error" ? "bg-red-50 text-red-900" : "bg-emerald-50 text-emerald-900"}`}>
          {resultado.mensaje}
        </p>
      )}
    </div>
  );
}
