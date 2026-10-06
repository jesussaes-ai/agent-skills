import { join } from "node:path";

/**
 * Embeddings multilingües. Por defecto, multilingual-e5-small (MIT, 384 dims),
 * ejecutado en local con transformers.js: gratuito y sin enviar texto fuera.
 * e5 requiere los prefijos «query: » y «passage: ». Cambiar de modelo implica
 * otra dimensión → migración nueva y reindexar (no se mezclan vectores).
 */
export interface ProveedorEmbeddings {
  readonly id: string;
  readonly modelo: string;
  readonly dimensiones: number;
  embeberPasajes(textos: string[]): Promise<number[][]>;
  embeberConsulta(texto: string): Promise<number[]>;
}

export const MODELO_POR_DEFECTO = "Xenova/multilingual-e5-small";
export const DIMENSIONES = 384;

type Extractor = (textos: string[], opciones: { pooling: "mean"; normalize: boolean }) => Promise<{ tolist(): number[][] }>;

const cargados = new Map<string, Promise<Extractor>>();

async function extractor(modelo: string): Promise<Extractor> {
  if (!cargados.has(modelo)) {
    cargados.set(
      modelo,
      (async () => {
        const { pipeline, env } = await import("@huggingface/transformers");
        env.cacheDir = process.env.MODELOS_CACHE?.trim() || join(process.cwd(), ".cache", "modelos");
        return (await pipeline("feature-extraction", modelo, { dtype: "q8" })) as unknown as Extractor;
      })(),
    );
  }
  return cargados.get(modelo)!;
}

export function crearEmbeddingsLocales(modelo = process.env.EMBEDDINGS_MODELO?.trim() || MODELO_POR_DEFECTO): ProveedorEmbeddings {
  const embeber = async (textos: string[]) => {
    const f = await extractor(modelo);
    const salida: number[][] = [];
    for (let i = 0; i < textos.length; i += 16) {
      salida.push(...(await f(textos.slice(i, i + 16), { pooling: "mean", normalize: true })).tolist());
    }
    for (const v of salida) {
      if (v.length !== DIMENSIONES) throw new Error(`El modelo ${modelo} produce ${v.length} dimensiones; la base espera ${DIMENSIONES}.`);
    }
    return salida;
  };
  return {
    id: "local-transformers",
    modelo,
    dimensiones: DIMENSIONES,
    embeberPasajes: (textos) => embeber(textos.map((t) => `passage: ${t}`)),
    embeberConsulta: async (texto) => (await embeber([`query: ${texto}`]))[0],
  };
}

/** Formato de pgvector para enviar por PostgREST. */
export function aVector(v: number[]): string {
  return `[${v.map((x) => x.toFixed(6)).join(",")}]`;
}
