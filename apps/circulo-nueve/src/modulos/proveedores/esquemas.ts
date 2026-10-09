import { z } from "zod";
import { PLANTILLAS, esModeloGratuito } from "./catalogo";
import { TIPOS_PROVEEDOR, type ConfigProveedor } from "./tipos";

/**
 * Solo se aceptan secretos con este prefijo: así un endpoint configurado desde
 * la interfaz nunca puede recibir otra variable del servidor (p. ej. la llave
 * de servicio de Supabase).
 */
export const PATRON_SECRETO = /^LLM_KEY_[A-Z0-9_]{1,40}$/;

const HOSTS_LOCALES = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[a-z0-9-]+\.local)$/i;

/** https siempre; http solo hacia la propia máquina o la red local. Sin credenciales en la URL. */
export function validarEndpoint(valor: string): string | null {
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    return "Escribe una URL completa, por ejemplo https://openrouter.ai/api/v1.";
  }
  if (url.username || url.password) return "La URL no puede llevar usuario ni contraseña; usa el secreto de la llave.";
  if (url.search || url.hash) return "La URL no puede llevar parámetros (?…) ni fragmentos (#…).";
  if (url.protocol === "https:") return null;
  if (url.protocol === "http:" && HOSTS_LOCALES.test(url.hostname)) return null;
  return "Usa https. Solo se acepta http para servidores en tu equipo o tu red local.";
}

export function normalizarEndpoint(valor: string): string {
  return valor.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/, "");
}

const numeroOpcional = (max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number({ error: "Escribe un número." }).min(0, "No puede ser negativo.").max(max, `Máximo ${max}.`).optional(),
  );
const numero = (min: number, max: number, porDefecto: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? porDefecto : Number(v)),
    z.number({ error: "Escribe un número." }).min(min, `Mínimo ${min}.`).max(max, `Máximo ${max}.`),
  );
const casilla = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const triestado = z.preprocess(
  (v) => (v === "si" ? true : v === "no" ? false : null),
  z.boolean().nullable(),
);
const idModelo = z
  .string()
  .trim()
  .min(1, "Elige o escribe un modelo.")
  .max(120, "El id del modelo es demasiado largo.")
  .regex(/^[\w.:/@~-]+$/, "El id del modelo solo admite letras, números y . : / @ ~ - _");

export const esquemaProveedor = z
  .object({
    id: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9][a-z0-9-]{1,39}$/, "Usa de 2 a 40 letras minúsculas, números o guiones."),
    tipo: z.enum(TIPOS_PROVEEDOR, { error: "Elige un tipo de proveedor." }),
    nombre: z.string().trim().min(1, "Escribe un nombre.").max(80),
    endpoint: z
      .string()
      .trim()
      .transform(normalizarEndpoint)
      .superRefine((v, ctx) => {
        const error = validarEndpoint(v);
        if (error) ctx.addIssue({ code: "custom", message: error });
      }),
    modelo: idModelo,
    modelosAlternos: z
      .string()
      .default("")
      .transform((v) => [...new Set(v.split(/[\n,]+/).map((m) => m.trim()).filter(Boolean))])
      .pipe(z.array(idModelo).max(5, "Máximo 5 modelos de respaldo.")),
    secretoNombre: z
      .string()
      .trim()
      .transform((v) => v.toUpperCase())
      .refine((v) => v === "" || PATRON_SECRETO.test(v), "El nombre debe empezar con LLM_KEY_ y usar solo A-Z, 0-9 y _."),
    destinatarios: z.string().trim().min(1, "Indica quién recibe los datos.").max(300),
    json: casilla,
    herramientas: casilla,
    vision: casilla,
    audio: casilla,
    permiteDatosReales: casilla,
    confirmoPolitica: casilla,
    exigirZdr: casilla,
    entrena: triestado,
    retiene: triestado,
    politicaDescripcion: z.string().trim().min(1, "Resume la política de datos del endpoint.").max(600),
    politicaFuente: z
      .string()
      .trim()
      .max(300)
      .refine((v) => v === "" || /^https:\/\//.test(v), "La fuente debe ser un enlace https."),
    solicitudesPorMinuto: numeroOpcional(10000),
    solicitudesPorDia: numeroOpcional(1_000_000),
    limiteMensualUsd: numeroOpcional(10000),
    maxTokensSalida: numero(16, 8000, 800),
    tiempoMaximoSegundos: numero(2, 120, 20),
    reintentos: numero(0, 4, 2),
    costoEntrada: numero(0, 1000, 0),
    costoSalida: numero(0, 1000, 0),
    prioridad: numero(0, 1000, 100),
    activo: casilla,
  })
  .superRefine((d, ctx) => {
    if (PLANTILLAS[d.tipo].requiereLlave && !d.secretoNombre) {
      ctx.addIssue({ code: "custom", path: ["secretoNombre"], message: "Este tipo de proveedor necesita el nombre del secreto con la llave." });
    }
    if (d.permiteDatosReales) {
      const motivo = motivoNoDatosReales({
        tipo: d.tipo,
        modelos: [d.modelo, ...d.modelosAlternos],
        entrena: d.entrena,
        retiene: d.retiene,
        exigirZdr: d.exigirZdr,
      });
      if (motivo) ctx.addIssue({ code: "custom", path: ["permiteDatosReales"], message: motivo });
      else if (!d.confirmoPolitica) {
        ctx.addIssue({ code: "custom", path: ["confirmoPolitica"], message: "Confirma que revisaste la política de datos vigente del endpoint." });
      }
    }
  });

export type DatosProveedor = z.infer<typeof esquemaProveedor>;

/** Por qué un proveedor NO puede marcarse como apto para datos reales; null si puede. */
export function motivoNoDatosReales(p: {
  tipo: ConfigProveedor["tipo"];
  modelos: string[];
  entrena?: boolean | null;
  retiene?: boolean | null;
  exigirZdr?: boolean;
}): string | null {
  if (p.tipo === "freellmapi") return "FreeLLMAPI reenvía a niveles gratuitos de terceros: solo puede usarse para demo.";
  if (p.modelos.some(esModeloGratuito)) return "Los modelos gratuitos solo pueden usarse para demo (registran o entrenan con los datos).";
  if (p.entrena !== false) return "Solo se permiten datos reales si la política dice que NO entrena con los datos.";
  if (p.tipo === "openrouter" && !p.exigirZdr) return "En OpenRouter, activa «Exigir retención cero (ZDR)» para permitir datos reales.";
  if (p.retiene !== false && !(p.tipo === "openrouter" && p.exigirZdr)) {
    return "Solo se permiten datos reales si la política dice que NO retiene los datos.";
  }
  return null;
}

export function configDesdeFormulario(d: DatosProveedor): ConfigProveedor {
  return {
    id: d.id,
    tipo: d.tipo,
    nombre: d.nombre,
    endpoint: d.endpoint,
    modelo: d.modelo,
    modelosAlternos: d.modelosAlternos.filter((m) => m !== d.modelo),
    secretoNombre: d.secretoNombre || undefined,
    destinatarios: d.destinatarios,
    capacidades: { json: d.json, herramientas: d.herramientas, vision: d.vision, audio: d.audio },
    politicaDatos: {
      permiteDatosReales: d.permiteDatosReales,
      descripcion: d.politicaDescripcion,
      entrena: d.entrena,
      retiene: d.retiene,
      exigirZdr: d.tipo === "openrouter" ? d.exigirZdr : false,
      fuente: d.politicaFuente || undefined,
      verificadoEn: new Date().toISOString().slice(0, 10),
    },
    limites: {
      solicitudesPorMinuto: d.solicitudesPorMinuto,
      solicitudesPorDia: d.solicitudesPorDia,
      limiteMensualUsd: d.limiteMensualUsd,
      maxTokensSalida: d.maxTokensSalida,
      tiempoMaximoMs: d.tiempoMaximoSegundos * 1000,
      reintentos: d.reintentos,
    },
    costo: { entradaUsdPorMillon: d.costoEntrada, salidaUsdPorMillon: d.costoSalida },
    activo: d.activo,
    prioridad: d.prioridad,
    origen: "base-de-datos",
  };
}

export const esquemaPreguntaAsistente = z.object({
  pregunta: z.string().trim().min(1).max(300),
  proveedorId: z.string().trim().min(1).max(40),
  /** Proveedores a los que la persona aceptó enviar su pregunta (el elegido y, opcionalmente, respaldos). */
  consentidos: z.array(z.string().max(40)).min(1).max(10),
});
