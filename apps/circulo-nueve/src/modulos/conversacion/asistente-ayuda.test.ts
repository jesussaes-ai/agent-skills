import { describe, expect, it } from "vitest";
import { SECCIONES_AYUDA } from "@/content/ayuda";
import type { LlmProvider, SolicitudLlm } from "@/modulos/proveedores";
import { BASE_CONOCIMIENTO_AYUDA, buscarEnAyuda, crearAsistenteDemo, crearAsistenteLlm, fragmentarAyuda } from "./index";

function llmFalso(responder: (s: SolicitudLlm) => string): LlmProvider & { ultima?: SolicitudLlm } {
  const llm: LlmProvider & { ultima?: SolicitudLlm } = {
    id: "falso",
    nombre: "LLM de prueba",
    modelo: "falso-1",
    capacidades: { json: true, herramientas: false, vision: false, audio: false },
    politicaDatos: { permiteDatosReales: false, descripcion: "prueba" },
    async completar(s) {
      llm.ultima = s;
      return { texto: responder(s), modelo: "falso-1" };
    },
  };
  return llm;
}

describe("búsqueda en el centro de ayuda", () => {
  it.each([
    ["¿Cómo se cuenta la ñ en la numerología?", "numerologia"],
    ["¿Qué falta del proyecto? ¿en qué etapa está?", "proyecto"],
    ["¿Cuándo estará la carta natal con ascendente?", "carta-natal"],
    ["¿Qué tabla de gematría usa la cábala?", "cabala"],
    ["¿Se guardan mis datos personales?", /consentimiento/],
    ["¿Cómo veo la explicación de un botón con el teclado?", "centro-ayuda"],
  ])("«%s» → %s", (pregunta, seccion: string | RegExp) => {
    const encontrada = buscarEnAyuda(pregunta, SECCIONES_AYUDA)[0]?.fragmento.seccionId;
    if (typeof seccion === "string") expect(encontrada).toBe(seccion);
    else expect(encontrada).toMatch(seccion);
  });

  it("no devuelve nada para preguntas ajenas", () => {
    expect(buscarEnAyuda("receta de paella valenciana", SECCIONES_AYUDA)).toEqual([]);
    expect(buscarEnAyuda("¿?", SECCIONES_AYUDA)).toEqual([]);
  });

  it("los ids de fragmento son únicos", () => {
    const ids = fragmentarAyuda(SECCIONES_AYUDA).map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("asistente demo", () => {
  it("responde con extractos literales citados", async () => {
    const r = await crearAsistenteDemo(SECCIONES_AYUDA).responder("números maestros");
    expect(r.modo).toBe("demo-busqueda");
    expect(r.sinRespaldo).toBe(false);
    const textos = new Set(fragmentarAyuda(SECCIONES_AYUDA).map((f) => f.texto));
    for (const a of r.afirmaciones) {
      expect(textos.has(a.texto)).toBe(true);
      expect(a.citas[0].base).toBe(BASE_CONOCIMIENTO_AYUDA);
      expect(a.citas[0].enlace).toMatch(/^\/ayuda#/);
    }
  });

  it("dice cuando no hay respaldo", async () => {
    const r = await crearAsistenteDemo(SECCIONES_AYUDA).responder("precio del dólar");
    expect(r.sinRespaldo).toBe(true);
    expect(r.afirmaciones[0].citas).toEqual([]);
  });
});

describe("asistente con LLM", () => {
  it("envía solo fragmentos recuperados y descarta citas inventadas", async () => {
    const llm = llmFalso((s) => {
      const id = /\[([^\]]+)\]/.exec(s.mensajes[1].contenido)![1];
      return JSON.stringify({
        afirmaciones: [
          { texto: "Afirmación respaldada.", fragmentos: [id] },
          { texto: "Afirmación inventada.", fragmentos: ["no-existe#0"] },
          { texto: "Sin citas." },
        ],
      });
    });
    const r = await crearAsistenteLlm(llm, SECCIONES_AYUDA).responder("¿cómo se cuenta la ñ?");
    expect(r.afirmaciones).toHaveLength(1);
    expect(r.afirmaciones[0]).toMatchObject({ texto: "Afirmación respaldada.", tipo: "generado" });
    expect(llm.ultima?.mensajes[1].contenido).toContain("<ayuda>");
  });

  it("no llama al LLM si no hay fragmentos", async () => {
    const llm = llmFalso(() => "{}");
    const r = await crearAsistenteLlm(llm, SECCIONES_AYUDA).responder("receta de paella");
    expect(r.sinRespaldo).toBe(true);
    expect(llm.ultima).toBeUndefined();
  });

  it("tolera JSON inválido", async () => {
    const r = await crearAsistenteLlm(llmFalso(() => "no es json"), SECCIONES_AYUDA).responder("numerología");
    expect(r.sinRespaldo).toBe(true);
  });
});
