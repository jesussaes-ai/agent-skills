import { createHash } from "node:crypto";
import type { ResultadoCarta } from "@/modulos/calculo/astrologia";

/** Huella de todo lo que determina el resultado: entradas, ajustes y versiones de motor, reglas, efemérides y tzdb. */
export function huellaCarta(r: ResultadoCarta): string {
  const base = {
    entradas: r.entradas,
    zonaHoraria: r.tiempo.zonaHoraria,
    ocurrencia: r.tiempo.estado === "repetida" ? r.tiempo.utc : undefined,
    config: r.config,
    motor: r.motor,
    motorVersion: r.motorVersion,
    reglasVersion: r.reglasVersion,
    efemerides: r.efemerides,
    tzdb: r.tiempo.versionTzdb,
  };
  return createHash("sha256").update(JSON.stringify(base)).digest("hex");
}
