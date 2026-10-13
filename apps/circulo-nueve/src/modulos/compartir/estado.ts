export type EstadoEnlace = "vigente" | "vencido" | "revocado" | "agotado";

export function estadoEnlace(
  e: { venceEl: string; revocadoEl: string | null; accesos: number; maxAccesos: number | null },
  ahora: Date = new Date(),
): EstadoEnlace {
  if (e.revocadoEl) return "revocado";
  if (new Date(e.venceEl).getTime() <= ahora.getTime()) return "vencido";
  if (e.maxAccesos !== null && e.accesos >= e.maxAccesos) return "agotado";
  return "vigente";
}

export const NOMBRE_ESTADO_ENLACE: Record<EstadoEnlace, string> = {
  vigente: "Vigente",
  vencido: "Vencido",
  revocado: "Revocado",
  agotado: "Sin descargas disponibles",
};

/** Opciones de vigencia en horas, recortadas a la vigencia máxima configurada. */
export function opcionesVigencia(maxDias: number): { horas: number; texto: string }[] {
  const todas = [
    { horas: 1, texto: "1 hora" },
    { horas: 24, texto: "1 día" },
    { horas: 72, texto: "3 días" },
    { horas: 168, texto: "7 días" },
    { horas: 336, texto: "14 días" },
    { horas: 720, texto: "30 días" },
  ];
  return todas.filter((o) => o.horas <= maxDias * 24);
}
