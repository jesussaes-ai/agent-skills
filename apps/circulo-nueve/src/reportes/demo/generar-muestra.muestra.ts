import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { generarReportePdf } from "../generar";
import { datosMuestraNumerologia } from "./muestra-numerologia";

it("escribe el PDF de demostración en demo/salida/", async () => {
  const carpeta = fileURLToPath(new URL("./salida/", import.meta.url));
  mkdirSync(carpeta, { recursive: true });
  const pdf = await generarReportePdf(datosMuestraNumerologia());
  writeFileSync(`${carpeta}muestra-numerologia.pdf`, pdf);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
});
