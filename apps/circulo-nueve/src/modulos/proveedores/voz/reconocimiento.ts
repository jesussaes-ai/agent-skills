/**
 * Dictado opcional con la Web Speech API. En muchos navegadores (por ejemplo,
 * Chrome) el audio se procesa en servidores del fabricante, así que la interfaz
 * pide permiso explícito antes de activar el micrófono.
 */

interface ResultadoReconocimiento {
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface ReconocedorNativo {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: ResultadoReconocimiento) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type Constructor = new () => ReconocedorNativo;

export function constructorReconocimiento(w: unknown = typeof window !== "undefined" ? window : undefined): Constructor | null {
  const v = w as { SpeechRecognition?: Constructor; webkitSpeechRecognition?: Constructor } | undefined;
  return v?.SpeechRecognition ?? v?.webkitSpeechRecognition ?? null;
}

export const MENSAJE_ERROR_DICTADO: Record<string, string> = {
  "not-allowed": "El navegador no dio permiso para usar el micrófono. Puedes activarlo en la configuración del sitio.",
  "service-not-allowed": "El navegador no permite el dictado en este sitio.",
  "no-speech": "No se escuchó nada. Vuelve a intentarlo.",
  "audio-capture": "No se encontró un micrófono.",
  network: "El dictado necesita conexión con el servicio de voz del navegador.",
  aborted: "Dictado detenido.",
};

export interface SesionDictado {
  detener(): void;
}

export function iniciarDictado(
  Rec: Constructor,
  opciones: { idioma: string; alTexto: (texto: string, final: boolean) => void; alError: (mensaje: string) => void; alTerminar: () => void },
): SesionDictado {
  const r = new Rec();
  r.lang = opciones.idioma;
  r.interimResults = true;
  r.continuous = false;
  r.maxAlternatives = 1;
  r.onresult = (e) => {
    let texto = "";
    let final = false;
    for (let i = 0; i < e.results.length; i++) {
      texto += e.results[i][0].transcript;
      final ||= e.results[i].isFinal;
    }
    opciones.alTexto(texto.trim(), final);
  };
  r.onerror = (e) => opciones.alError(MENSAJE_ERROR_DICTADO[e.error] ?? "No se pudo usar el dictado.");
  r.onend = () => opciones.alTerminar();
  r.start();
  return { detener: () => r.stop() };
}
