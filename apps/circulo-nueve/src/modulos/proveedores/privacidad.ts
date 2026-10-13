import { esModeloGratuito } from "./catalogo";
import type { ConfigProveedor, ProveedorPublico } from "./tipos";

export type TipoDatoPersonal = "correo" | "telefono" | "fecha" | "curp" | "rfc" | "tarjeta";

const MESES = "enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre";

const PATRONES: [TipoDatoPersonal, RegExp][] = [
  ["correo", /[\w.+-]+@[\w-]+\.[\w.-]+/],
  ["curp", /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z\d]\d\b/i],
  ["rfc", /\b[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}\b/i],
  ["tarjeta", /\b(?:\d[ -]?){13,19}\b/],
  ["telefono", /(?:\+?\d{1,3}[ .-]?)?(?:\(?\d{2,3}\)?[ .-]?)\d{3,4}[ .-]?\d{4}\b/],
  ["fecha", new RegExp(`\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}\\s+de\\s+(?:${MESES})(?:\\s+de)?\\s+\\d{4}\\b`, "i")],
];

/**
 * Detección simple de datos identificables. No pretende ser exhaustiva: es una
 * barrera para no mandar, por descuido, correos, teléfonos o fechas de
 * nacimiento a proveedores marcados «solo demo».
 */
export function detectarDatosPersonales(texto: string): TipoDatoPersonal[] {
  const encontrados: TipoDatoPersonal[] = [];
  for (const [tipo, patron] of PATRONES) {
    if (patron.test(texto) && !(tipo === "telefono" && encontrados.includes("tarjeta"))) encontrados.push(tipo);
  }
  return encontrados;
}

export const NOMBRE_DATO: Record<TipoDatoPersonal, string> = {
  correo: "un correo",
  telefono: "un teléfono",
  fecha: "una fecha",
  curp: "una CURP",
  rfc: "un RFC",
  tarjeta: "un número de tarjeta",
};

export function aPublico(p: ConfigProveedor): ProveedorPublico {
  return {
    id: p.id,
    tipo: p.tipo,
    nombre: p.nombre,
    modelo: p.modelo,
    modelosAlternos: p.modelosAlternos,
    destinatarios: p.destinatarios,
    politicaDatos: {
      permiteDatosReales: p.politicaDatos.permiteDatosReales,
      descripcion: p.politicaDatos.descripcion,
      entrena: p.politicaDatos.entrena ?? null,
      retiene: p.politicaDatos.retiene ?? null,
      exigirZdr: p.politicaDatos.exigirZdr ?? false,
    },
    capacidades: p.capacidades,
    gratuito: [p.modelo, ...p.modelosAlternos].every(esModeloGratuito),
  };
}

/** Texto que la persona acepta antes de enviar. Lo usan la interfaz y las pruebas. */
export function textoConsentimiento(p: ProveedorPublico): string {
  const modelos = [p.modelo, ...p.modelosAlternos].join(", ");
  const uso = p.politicaDatos.permiteDatosReales
    ? "La administración lo marcó como apto para datos reales."
    : "Es solo para demostración: no escribas datos personales.";
  return `Se enviarán tu pregunta y hasta 6 fragmentos del Centro de ayuda. Los recibe: ${p.destinatarios.replace(/\.$/, "")}. Modelos: ${modelos}. ${uso}`;
}
