import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generarReportePdf } from "../generar";
import { datosMuestraCartaNatal } from "./muestra-carta-natal";
import { datosMuestraNumerologia } from "./muestra-numerologia";

const MUESTRAS = { "muestra-numerologia": datosMuestraNumerologia, "muestra-carta-natal": datosMuestraCartaNatal };

for (const [nombre, datos] of Object.entries(MUESTRAS)) {
  it(`escribe ${nombre}.pdf en demo/salida/`, async () => {
    const carpeta = fileURLToPath(new URL("./salida/", import.meta.url));
    mkdirSync(carpeta, { recursive: true });
    const pdf = await generarReportePdf(datos());
    writeFileSync(`${carpeta}${nombre}.pdf`, pdf);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
}
