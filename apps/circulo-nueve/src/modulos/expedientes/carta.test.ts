import { describe, expect, it } from "vitest";
import { CONFIG_POR_DEFECTO, calcularCartaNatal, type ResultadoCarta } from "@/modulos/calculo/astrologia";
import { LUGAR_MUESTRA } from "@/reportes/demo/muestra-carta-natal";
import { esquemaGuardarCarta } from "./esquemas-carta";
import { huellaCarta } from "./huella-carta";

const ID = "8f0c2f7e-2b5a-4c1e-9a43-3f2d6c1b7a10";

function carta(config = {}): ResultadoCarta {
  const r = calcularCartaNatal({ fecha: "1988-11-23", hora: "06:40", precisionHora: "exacta", lugar: LUGAR_MUESTRA }, config);
  if (!r.ok) throw new Error(r.errores.join(" "));
  return r;
}

describe("formulario para guardar la carta", () => {
  it("acepta un lugar de GeoNames con los ajustes en JSON", () => {
    const r = esquemaGuardarCarta.safeParse({ expedienteId: ID, lugarTipo: "geonames", geonameId: "4005539", config: JSON.stringify(CONFIG_POR_DEFECTO), ocurrencia: "" });
    expect(r.success).toBe(true);
  });
  it("acepta coordenadas manuales dentro de rango y rechaza las inválidas", () => {
    const base = { expedienteId: ID, lugarTipo: "manual", nombreLugar: "Hospital", latitud: "19.4", longitud: "-99.1", zonaLugar: "America/Mexico_City", config: JSON.stringify(CONFIG_POR_DEFECTO) };
    expect(esquemaGuardarCarta.safeParse(base).success).toBe(true);
    expect(esquemaGuardarCarta.safeParse({ ...base, latitud: "95" }).success).toBe(false);
  });
  it("rechaza ajustes fuera de lo permitido, JSON roto o expedientes sin UUID", () => {
    const ok = { expedienteId: ID, lugarTipo: "geonames", geonameId: "1" };
    expect(esquemaGuardarCarta.safeParse({ ...ok, config: JSON.stringify({ ...CONFIG_POR_DEFECTO, sistemaCasas: "topocentrico" }) }).success).toBe(false);
    expect(esquemaGuardarCarta.safeParse({ ...ok, config: JSON.stringify({ ...CONFIG_POR_DEFECTO, margenAproximadaMin: 999 }) }).success).toBe(false);
    expect(esquemaGuardarCarta.safeParse({ ...ok, config: "{" }).success).toBe(false);
    expect(esquemaGuardarCarta.safeParse({ ...ok, expedienteId: "x", config: JSON.stringify(CONFIG_POR_DEFECTO) }).success).toBe(false);
  });
});

describe("huella de la carta guardada", () => {
  it("es estable para las mismas entradas y cambia con los ajustes", () => {
    expect(huellaCarta(carta())).toBe(huellaCarta(carta()));
    expect(huellaCarta(carta())).toMatch(/^[0-9a-f]{64}$/);
    expect(huellaCarta(carta({ sistemaCasas: "koch" }))).not.toBe(huellaCarta(carta()));
    expect(huellaCarta(carta({ zodiaco: "sideral" }))).not.toBe(huellaCarta(carta()));
  });
});
