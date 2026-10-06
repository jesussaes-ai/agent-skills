import { describe, expect, it } from "vitest";
import { MENSAJE_ERROR_DICTADO, constructorReconocimiento, iniciarDictado, type ReconocedorNativo } from "./reconocimiento";
import { aVozDisponible, clasificarVoces, dividirParaVoz, elegirVoz, etiquetaVoz, pistaMasculina, regionDe, type VozNavegador } from "./voces";
import { crearTtsWebSpeech, type LocucionVoz, type SintetizadorVoz } from "./web-speech";

const VOCES: VozNavegador[] = [
  { voiceURI: "Google español", name: "Google español", lang: "es-ES", localService: false },
  { voiceURI: "Microsoft Jorge - Spanish (Mexico)", name: "Microsoft Jorge - Spanish (Mexico)", lang: "es-MX", localService: true },
  { voiceURI: "Paulina", name: "Paulina", lang: "es_MX", localService: true },
  { voiceURI: "Microsoft Pablo - Spanish (Spain)", name: "Microsoft Pablo - Spanish (Spain)", lang: "es-ES", localService: true },
  { voiceURI: "Diego", name: "Diego", lang: "es-AR", localService: true },
  { voiceURI: "Samantha", name: "Samantha", lang: "en-US", localService: true },
];

describe("clasificación de voces", () => {
  it("prioriza es-MX, luego es-ES, la posible voz masculina y la local", () => {
    const c = clasificarVoces(VOCES.map(aVozDisponible));
    expect(c.coincidentes.map((v) => v.nombre)).toEqual([
      "Microsoft Jorge - Spanish (Mexico)",
      "Paulina",
      "Microsoft Pablo - Spanish (Spain)",
      "Google español",
    ]);
    expect(c.otrasEspanol.map((v) => v.nombre)).toEqual(["Diego"]);
    expect(c.total).toBe(6);
  });

  it("reconoce regiones y pistas de género sin afirmar de más", () => {
    expect(regionDe("es_MX")).toBe("es-MX");
    expect(regionDe("es-419")).toBe("es-otro");
    expect(regionDe("en-US")).toBeNull();
    expect(pistaMasculina("Jorge")).toBe(true);
    expect(pistaMasculina("José (mejorada)")).toBe(true);
    expect(pistaMasculina("Mónica")).toBe(false);
    expect(pistaMasculina("Female 2")).toBe(false);
    expect(pistaMasculina("Google español")).toBeNull();
  });

  it("informa cuando ninguna voz coincide", () => {
    const c = clasificarVoces([aVozDisponible(VOCES[5])]);
    expect(c.coincidentes).toEqual([]);
    expect(elegirVoz(c)).toBeUndefined();
  });

  it("respeta la voz guardada si sigue disponible y marca las remotas", () => {
    const c = clasificarVoces(VOCES.map(aVozDisponible));
    expect(elegirVoz(c, "Paulina")?.nombre).toBe("Paulina");
    expect(elegirVoz(c, "ya-no-existe")?.nombre).toBe("Microsoft Jorge - Spanish (Mexico)");
    expect(etiquetaVoz(c.coincidentes.at(-1)!)).toBe("Google español — es-ES · remota");
    expect(etiquetaVoz(c.coincidentes[0])).toContain("en el dispositivo · posible voz masculina");
  });

  it("divide textos largos por oración", () => {
    const texto = "Primera oración. ".repeat(30);
    const partes = dividirParaVoz(texto, 100);
    expect(partes.every((p) => p.length <= 100)).toBe(true);
    expect(partes.join(" ").replace(/\s+/g, " ")).toBe(texto.trim());
    expect(dividirParaVoz("   ")).toEqual([]);
  });
});

function sintetizadorFalso(voces: VozNavegador[] = VOCES) {
  const habladas: LocucionVoz[] = [];
  const eventos: string[] = [];
  const s: SintetizadorVoz = {
    getVoices: () => voces,
    speak: (u) => {
      habladas.push(u);
      queueMicrotask(() => u.onend?.());
    },
    cancel: () => eventos.push("cancel"),
    pause: () => eventos.push("pause"),
    resume: () => eventos.push("resume"),
  };
  const crear = (text: string): LocucionVoz => ({ text, lang: "", voice: null, rate: 1, onend: null, onerror: null });
  return { s, crear, habladas, eventos };
}

describe("síntesis con Web Speech API", () => {
  it("lista voces y habla con la voz elegida, por fragmentos", async () => {
    const f = sintetizadorFalso();
    const tts = crearTtsWebSpeech(f.s, f.crear);
    expect(tts.disponible()).toBe(true);
    expect((await tts.listarVoces()).length).toBe(6);
    await tts.hablar("Hola. ".repeat(60), "Microsoft Jorge - Spanish (Mexico)");
    expect(f.habladas.length).toBeGreaterThan(1);
    expect(f.habladas[0]).toMatchObject({ lang: "es-MX", voice: VOCES[1] });
  });

  it("pausa, reanuda y detiene", () => {
    const f = sintetizadorFalso();
    const tts = crearTtsWebSpeech(f.s, f.crear);
    tts.pausar();
    tts.reanudar();
    tts.detener();
    expect(f.eventos).toEqual(["pause", "resume", "cancel"]);
  });

  it("espera a «voiceschanged» si las voces aún no cargan", async () => {
    let fn: (() => void) | undefined;
    let voces: VozNavegador[] = [];
    const f = sintetizadorFalso();
    const s: SintetizadorVoz = { ...f.s, getVoices: () => voces, addEventListener: (_t, cb) => (fn = cb), removeEventListener: () => {} };
    const promesa = crearTtsWebSpeech(s, f.crear, 5000).listarVoces();
    voces = VOCES;
    fn?.();
    expect((await promesa).length).toBe(6);
  });

  it("sin soporte del navegador no está disponible", async () => {
    const tts = crearTtsWebSpeech(undefined, undefined);
    expect(tts.disponible()).toBe(false);
    expect(await tts.listarVoces()).toEqual([]);
    await expect(tts.hablar("hola")).rejects.toThrow(/síntesis de voz/);
  });
});

describe("dictado", () => {
  it("detecta el soporte con o sin prefijo", () => {
    class R {}
    expect(constructorReconocimiento({ webkitSpeechRecognition: R })).toBe(R);
    expect(constructorReconocimiento({})).toBeNull();
  });

  it("entrega el texto reconocido y traduce los errores", () => {
    let instancia: ReconocedorNativo | undefined;
    class Falso implements ReconocedorNativo {
      lang = "";
      interimResults = false;
      continuous = true;
      maxAlternatives = 0;
      onresult: ReconocedorNativo["onresult"] = null;
      onerror: ReconocedorNativo["onerror"] = null;
      onend: ReconocedorNativo["onend"] = null;
      iniciado = false;
      constructor() {
        instancia = this;
      }
      start() {
        this.iniciado = true;
      }
      stop() {}
      abort() {}
    }
    const textos: [string, boolean][] = [];
    const errores: string[] = [];
    iniciarDictado(Falso, { idioma: "es-MX", alTexto: (t, f) => textos.push([t, f]), alError: (m) => errores.push(m), alTerminar: () => {} });
    expect(instancia).toMatchObject({ lang: "es-MX", interimResults: true, continuous: false });
    const resultado = Object.assign([{ transcript: " qué es la cábala " }], { isFinal: true });
    instancia!.onresult!({ results: [resultado] });
    instancia!.onerror!({ error: "not-allowed" });
    expect(textos).toEqual([["qué es la cábala", true]]);
    expect(errores).toEqual([MENSAJE_ERROR_DICTADO["not-allowed"]]);
  });
});
