/**
 * Detección heurística de texto con forma de instrucción dirigida a un modelo
 * (prompt injection). Solo marca: el fragmento sigue tratándose como dato y la
 * revisión decide si se excluye. No es una garantía; la defensa principal es que
 * el contenido nunca se trate como instrucción y que la salida se valide.
 */
const PATRONES: [RegExp, string][] = [
  [/\b(ignora|olvida|omite|desobedece)\b[^.\n]{0,40}\b(instrucciones|indicaciones|reglas|anteriores|previas)\b/i, "pide ignorar instrucciones"],
  [/\b(ignore|disregard|forget)\b[^.\n]{0,40}\b(instructions|previous|above|rules)\b/i, "pide ignorar instrucciones (inglés)"],
  [/\b(system prompt|prompt del sistema|mensaje del sistema|instrucciones del sistema)\b/i, "menciona el prompt del sistema"],
  [/\b(a partir de ahora|desde ahora)\b[^.\n]{0,30}\b(eres|serás|actúa|responde)\b/i, "intenta cambiar el rol del asistente"],
  [/\b(you are now|act as|from now on)\b/i, "intenta cambiar el rol del asistente (inglés)"],
  [/^\s*(system|assistant|user|sistema|asistente)\s*:/im, "imita mensajes de rol"],
  [/<\/?(script|iframe|system|instructions?)\b/i, "contiene etiquetas de control"],
  [/\b(revela|muestra|imprime|envía)\b[^.\n]{0,30}\b(clave|contraseña|token|secreto|api key)\b/i, "pide secretos"],
  [/\b(visita|abre|descarga|haz clic)\b[^.\n]{0,40}https?:\/\//i, "pide seguir un enlace"],
];

export function detectarInyeccion(texto: string): { sospechoso: boolean; motivos: string[] } {
  const motivos = PATRONES.filter(([p]) => p.test(texto)).map(([, m]) => m);
  return { sospechoso: motivos.length > 0, motivos };
}

/** Neutraliza delimitadores que podrían cerrar el bloque de datos no confiables. */
export function neutralizarParaPrompt(texto: string): string {
  return texto.replace(/<\/?\s*(datos|fragmento|instrucciones|system)[^>]*>/gi, "[etiqueta eliminada]").replace(/`{3,}/g, "``");
}
