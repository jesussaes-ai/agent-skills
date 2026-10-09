"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { TtsProvider } from "@/modulos/proveedores/tipos";
import { FRASE_PRUEBA, clasificarVoces, elegirVoz, etiquetaVoz, type VocesClasificadas } from "@/modulos/proveedores/voz/voces";
import { crearTtsWebSpeech } from "@/modulos/proveedores/voz/web-speech";
import { AyudaContextual } from "@/ui/componentes/AyudaContextual";
import { Boton } from "@/ui/componentes/Boton";

const CLAVE_PREFERENCIA = "circulo-nueve.voz.v1";

type Estado = "cargando" | "sin-soporte" | "listo";
type Reproduccion = "detenida" | "hablando" | "pausada";

interface Props {
  /** Texto que se puede leer en voz alta (la respuesta escrita sigue visible). */
  texto: string;
  /** Crea el proveedor de voz; por defecto, la voz del navegador. */
  crearTts?: () => TtsProvider;
}

export function ControlesVoz({ texto, crearTts = crearTtsWebSpeech }: Props) {
  const tts = useRef<TtsProvider | null>(null);
  const [estado, setEstado] = useState<Estado>("cargando");
  const [voces, setVoces] = useState<VocesClasificadas | null>(null);
  const [vozId, setVozId] = useState("");
  const [mostrarOtras, setMostrarOtras] = useState(false);
  const [reproduccion, setReproduccion] = useState<Reproduccion>("detenida");
  const [aceptaRemota, setAceptaRemota] = useState(false);
  const [error, setError] = useState("");
  const idSelector = useId();
  const idNota = useId();

  useEffect(() => {
    const proveedor = crearTts();
    tts.current = proveedor;
    if (!proveedor.disponible()) {
      setEstado("sin-soporte");
      return;
    }
    let vigente = true;
    void proveedor.listarVoces().then((lista) => {
      if (!vigente) return;
      const clasificadas = clasificarVoces(lista);
      setVoces(clasificadas);
      setVozId(elegirVoz(clasificadas, localStorage.getItem(CLAVE_PREFERENCIA))?.id ?? "");
      setEstado("listo");
    });
    return () => {
      vigente = false;
      proveedor.detener();
    };
  }, [crearTts]);

  useEffect(() => {
    tts.current?.detener();
    setReproduccion("detenida");
  }, [texto]);

  if (estado === "cargando") return <p className="text-sm text-slate-600">Buscando voces del dispositivo…</p>;
  if (estado === "sin-soporte") {
    return (
      <p role="note" className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
        Este navegador no ofrece síntesis de voz. La respuesta escrita sigue disponible.
      </p>
    );
  }

  const lista = voces ? [...voces.coincidentes, ...(mostrarOtras || !voces.coincidentes.length ? voces.otrasEspanol : [])] : [];
  const elegida = lista.find((v) => v.id === vozId);
  const remota = elegida ? !elegida.local : false;

  const hablar = async (contenido: string) => {
    if (!tts.current) return;
    setError("");
    setReproduccion("hablando");
    try {
      await tts.current.hablar(contenido, vozId || undefined);
    } catch (e) {
      setError((e as Error).message || "No se pudo reproducir la voz.");
    } finally {
      setReproduccion("detenida");
    }
  };

  const elegir = (id: string) => {
    setVozId(id);
    setAceptaRemota(false);
    localStorage.setItem(CLAVE_PREFERENCIA, id);
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-3">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={idSelector} className="text-sm font-medium text-slate-700">
            Voz
          </label>
          <AyudaContextual seccion="voz" />
        </div>
        <select
          id={idSelector}
          value={vozId}
          onChange={(e) => elegir(e.target.value)}
          aria-describedby={idNota}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base"
        >
          {!lista.length && <option value="">Voz predeterminada del navegador</option>}
          {lista.map((v) => (
            <option key={v.id} value={v.id}>
              {etiquetaVoz(v)}
            </option>
          ))}
        </select>
        <span id={idNota} className="text-xs text-slate-600">
          Voces es-MX y es-ES instaladas en este dispositivo ({voces?.coincidentes.length ?? 0} de {voces?.total ?? 0}). El navegador no
          indica el género de forma uniforme: «posible voz masculina» es una pista por el nombre. Tu elección se guarda solo en este navegador.
        </span>
      </div>

      {voces && !voces.coincidentes.length && (
        <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Ninguna voz instalada coincide con es-MX o es-ES.{" "}
          {voces.otrasEspanol.length
            ? "Se muestran otras variantes del español."
            : "Se usará la voz predeterminada del navegador; puedes instalar voces en español desde la configuración de tu sistema."}
        </p>
      )}
      {voces && voces.coincidentes.length > 0 && voces.otrasEspanol.length > 0 && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={mostrarOtras} onChange={(e) => setMostrarOtras(e.target.checked)} />
          Mostrar también otras variantes del español ({voces.otrasEspanol.length})
        </label>
      )}

      {remota && (
        <div role="note" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          <p>
            <strong>Voz remota.</strong> Con esta voz el texto se envía al servicio de voz del fabricante del navegador para generar el audio.
            La prueba usa una frase fija; para leer una respuesta necesitas aceptarlo.
          </p>
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={aceptaRemota} onChange={(e) => setAceptaRemota(e.target.checked)} className="mt-1" />
            Acepto que el texto de la respuesta se envíe a ese servicio de voz.
          </label>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Boton
          variante="secundario"
          descripcion="Lee una frase fija de prueba con la voz elegida. No incluye datos tuyos."
          onClick={() => void hablar(FRASE_PRUEBA)}
          disabled={reproduccion !== "detenida"}
        >
          Probar voz
        </Boton>
        <Boton
          descripcion={
            remota && !aceptaRemota
              ? "Primero acepta el envío a la voz remota o elige una voz del dispositivo."
              : "Lee en voz alta la respuesta que aparece arriba. El texto escrito sigue visible."
          }
          onClick={() => void hablar(texto)}
          disabled={!texto.trim() || reproduccion !== "detenida" || (remota && !aceptaRemota)}
        >
          Leer respuesta
        </Boton>
        <Boton
          variante="secundario"
          descripcion={reproduccion === "pausada" ? "Continúa la lectura donde se pausó." : "Pausa la lectura en voz alta."}
          disabled={reproduccion === "detenida"}
          onClick={() => {
            if (reproduccion === "pausada") {
              tts.current?.reanudar();
              setReproduccion("hablando");
            } else {
              tts.current?.pausar();
              setReproduccion("pausada");
            }
          }}
        >
          {reproduccion === "pausada" ? "Reanudar" : "Pausar"}
        </Boton>
        <Boton
          variante="secundario"
          descripcion="Detiene la lectura en voz alta."
          disabled={reproduccion === "detenida"}
          onClick={() => {
            tts.current?.detener();
            setReproduccion("detenida");
          }}
        >
          Detener
        </Boton>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
