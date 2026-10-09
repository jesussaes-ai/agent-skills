import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import { DocumentoReporte } from "./DocumentoReporte";
import { registrarFuentes } from "./recursos";
import type { DatosReporte } from "./tipos";

/** Genera el PDF en servidor. Nunca llamar desde código cliente: incrusta datos personales. */
export async function generarReportePdf(datos: DatosReporte): Promise<Buffer> {
  registrarFuentes();
  // renderToBuffer espera un elemento <Document>; DocumentoReporte lo devuelve.
  const documento = createElement(DocumentoReporte, { datos }) as unknown as ReactElement<Parameters<typeof renderToBuffer>[0]["props"]>;
  return renderToBuffer(documento);
}
