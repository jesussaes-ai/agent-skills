import type { TtsProvider, VozDisponible } from "../tipos";
import { aVozDisponible, dividirParaVoz, type VozNavegador } from "./voces";

/** Lo que usamos de speechSynthesis; permite probar con un doble. */
export interface SintetizadorVoz {
  getVoices(): VozNavegador[];
  speak(u: LocucionVoz): void;
  cancel(): void;
  pause(): void;
  resume(): void;
  addEventListener?(tipo: "voiceschanged", fn: () => void): void;
  removeEventListener?(tipo: "voiceschanged", fn: () => void): void;
}

export interface LocucionVoz {
  text: string;
  lang: string;
  voice: unknown;
  rate: number;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

export type CrearLocucion = (texto: string) => LocucionVoz;

function sintetizadorDelNavegador(): SintetizadorVoz | undefined {
  return typeof window !== "undefined" && window.speechSynthesis ? (window.speechSynthesis as unknown as SintetizadorVoz) : undefined;
}

function locucionDelNavegador(): CrearLocucion | undefined {
  if (typeof window === "undefined" || typeof window.SpeechSynthesisUtterance !== "function") return undefined;
  return (t) => new window.SpeechSynthesisUtterance(t) as unknown as LocucionVoz;
}

/**
 * Síntesis gratuita con la Web Speech API del navegador. Las voces «remotas»
 * (localService = false) envían el texto al servicio del fabricante; la
 * interfaz avisa y pide consentimiento antes de usarlas con datos personales.
 */
export function crearTtsWebSpeech(
  sintetizador: SintetizadorVoz | undefined = sintetizadorDelNavegador(),
  crearLocucion: CrearLocucion | undefined = locucionDelNavegador(),
  esperaVocesMs = 1500,
): TtsProvider & { vozNativa(id: string): VozNavegador | undefined } {
  let generacion = 0;
  const nativas = () => sintetizador?.getVoices() ?? [];

  return {
    id: "web-speech",
    nombre: "Voz del navegador (Web Speech API)",
    remoto: false,
    disponible: () => Boolean(sintetizador && crearLocucion),
    vozNativa: (id) => nativas().find((v) => (v.voiceURI || v.name) === id),

    async listarVoces(): Promise<VozDisponible[]> {
      if (!sintetizador) return [];
      let voces = nativas();
      if (!voces.length && sintetizador.addEventListener) {
        // Chrome carga las voces de forma asíncrona y avisa con «voiceschanged».
        await new Promise<void>((listo) => {
          const fin = () => {
            sintetizador.removeEventListener?.("voiceschanged", fin);
            listo();
          };
          sintetizador.addEventListener?.("voiceschanged", fin);
          setTimeout(fin, esperaVocesMs);
        });
        voces = nativas();
      }
      return voces.map(aVozDisponible);
    },

    hablar(texto, vozId) {
      if (!sintetizador || !crearLocucion) return Promise.reject(new Error("Este navegador no tiene síntesis de voz."));
      sintetizador.cancel();
      const mia = ++generacion;
      const voz = vozId ? nativas().find((v) => (v.voiceURI || v.name) === vozId) : undefined;
      const fragmentos = dividirParaVoz(texto);
      if (!fragmentos.length) return Promise.resolve();
      return new Promise<void>((resolver, rechazar) => {
        fragmentos.forEach((f, i) => {
          const u = crearLocucion(f);
          u.lang = voz?.lang ?? "es-MX";
          u.voice = voz ?? null;
          u.rate = 1;
          u.onerror = (e) => {
            // «interrupted»/«canceled» llegan al detener: no son errores para la persona.
            if (e.error === "interrupted" || e.error === "canceled" || mia !== generacion) resolver();
            else rechazar(new Error(e.error ?? "Error de síntesis de voz."));
          };
          u.onend = i === fragmentos.length - 1 ? () => resolver() : null;
          sintetizador.speak(u);
        });
      });
    },
    pausar: () => sintetizador?.pause(),
    reanudar: () => sintetizador?.resume(),
    detener: () => {
      generacion++;
      sintetizador?.cancel();
    },
  };
}
