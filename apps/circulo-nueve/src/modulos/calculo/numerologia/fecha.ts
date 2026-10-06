export interface FechaValida {
  anio: number;
  mes: number;
  dia: number;
}

/** Acepta solo AAAA-MM-DD con una fecha real del calendario gregoriano. No completa datos faltantes. */
export function validarFecha(fecha: string): { ok: true; fecha: FechaValida } | { ok: false; error: string } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fecha.trim());
  if (!m) return { ok: false, error: "La fecha debe tener el formato AAAA-MM-DD." };
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (anio < 1) return { ok: false, error: "El año debe ser 0001 o posterior." };
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  d.setUTCFullYear(anio);
  if (d.getUTCFullYear() !== anio || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) {
    return { ok: false, error: `La fecha ${fecha} no existe en el calendario.` };
  }
  return { ok: true, fecha: { anio, mes, dia } };
}
