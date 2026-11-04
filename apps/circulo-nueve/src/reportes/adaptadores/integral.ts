import type { IndicadorAvanzado } from "@/modulos/calculo/numerologia/avanzada";
import type { ResultadoConsulta } from "@/modulos/consulta/integral";
import type { Calculo, DatoAutorizado, DatosReporte, TablaReporte } from "../tipos";
import { calculosDeCarta, datosAutorizadosDeCarta, limitesDeCarta, ruedaDeCarta, tablasDeCarta, textoPdf } from "./carta-natal";
import { calculosDeNumerologia, datosAutorizadosDeNumerologia, limitesDeNumerologia } from "./numerologia";

const calculoAvanzado = (i: IndicadorAvanzado, subtitulo?: string): Calculo => ({
  titulo: i.nombre,
  valor: String(i.valor),
  subtitulo: subtitulo ?? i.descripcion,
  destacado: i.esMaestro ? "Número maestro" : undefined,
  pasos: i.pasos.map((p) => ({ descripcion: p.descripcion, operacion: p.operacion })),
});

/** Las fuentes del PDF no tienen letras hebreas: se dejan solo sus nombres en español («Álef (1)»). */
export const textoIntegral = (s: string) => textoPdf(s).replace(/[֐-׿]+ ?/g, "").replace(/ {2,}/g, " ").trim();

const edades = (inicio: number, fin: number | null) => (fin === null ? `desde los ${inicio} años` : `de los ${inicio} a los ${fin} años`);

export type CamposIntegralReporte = Pick<
  DatosReporte,
  "tipo" | "tradicion" | "versionReglas" | "datosAutorizados" | "calculos" | "tablas" | "rueda" | "limites"
>;

/** Une todos los cálculos de la consulta en los datos de una sola carta PDF («lectura integral»). */
export function reporteIntegral(r: ResultadoConsulta): CamposIntegralReporte {
  const datos: DatoAutorizado[] = [...datosAutorizadosDeNumerologia(r.numerologia)];
  if (r.carta) {
    for (const d of datosAutorizadosDeCarta(r.carta)) if (!datos.some((x) => x.etiqueta === d.etiqueta)) datos.push(d);
  }
  if (r.cabala) {
    datos.push({
      etiqueta: "Nombre en letras hebreas",
      valor: r.cabala.letras.map((l) => l.nombre).join(" · "),
      nota: `Transliteración aprobada por la persona (reglas ${r.cabala.transliteracionVersion}).`,
    });
  }

  const calculos: Calculo[] = [...calculosDeNumerologia(r.numerologia)];
  if (r.ciclo) {
    const sub = `Para la fecha de la consulta, ${r.ciclo.entradas.fechaConsulta}.`;
    calculos.push(calculoAvanzado(r.ciclo.anioPersonal, sub), calculoAvanzado(r.ciclo.mesPersonal, sub), calculoAvanzado(r.ciclo.diaPersonal, sub));
  }
  if (r.cabala) {
    const c = r.cabala;
    calculos.push(
      {
        titulo: "Gematría del nombre (Mispar Hejrají)",
        valor: String(c.totales.hejraji),
        subtitulo: `Mispar Gadol ${c.totales.gadol} · Mispar Katán ${c.totales.katan} · reducción ${c.reduccion.valor}`,
        pasos: c.pasos.map((p) => ({ descripcion: p.descripcion, operacion: p.operacion })),
      },
      {
        titulo: "Reducción cabalística",
        valor: String(c.reduccion.valor),
        pasos: c.reduccion.pasos.map((p) => ({ descripcion: p.descripcion, operacion: p.operacion })),
      },
    );
  }
  if (r.carta) calculos.push(...calculosDeCarta(r.carta));

  const tablas: TablaReporte[] = [];
  if (r.pinaculos) {
    tablas.push({
      titulo: "Pináculos y desafíos",
      nota: `Camino de vida reducido a un dígito: ${r.pinaculos.caminoDeVida.unDigito}.`,
      columnas: ["Etapa", "Edades", "Pináculo", "Desafío"],
      anchos: [1, 2, 1, 1],
      filas: r.pinaculos.pinaculos.map((p, i) => [String(p.numero), edades(p.edadInicio, p.edadFin), String(p.valor), String(r.pinaculos!.desafios[i]?.valor ?? "")]),
    });
  }
  if (r.cabala) {
    tablas.push({
      titulo: "Letras del nombre",
      columnas: ["Letra", "Lugar", "Hejrají", "Gadol", "Katán", "Sendero"],
      anchos: [2, 1, 1, 1, 1, 1],
      filas: r.cabala.letras.map((l) => [l.nombre, String(l.orden), String(l.valor), String(l.valorGadol), String(l.valorKatan), String(l.senderoHermetico)]),
    });
    if (r.cabala.correspondencias.length) {
      tablas.push({
        titulo: "Números y sefirot del Árbol de la Vida",
        columnas: ["Número de origen", "Valor", "Sefirá", "Significado", "Pilar"],
        anchos: [2, 1, 1, 2, 2],
        filas: r.cabala.correspondencias.map((c) => [c.origen, String(c.numero), `${c.numeroSefira}. ${c.sefira.nombre}`, c.sefira.significado, c.sefira.pilar]),
      });
    }
  }
  if (r.carta) tablas.push(...tablasDeCarta(r.carta));

  const limites = [
    ...limitesDeNumerologia(r.numerologia),
    ...(r.cabala ? [`Cábala: ${r.cabala.tradicion} (motor ${r.cabala.motor} ${r.cabala.motorVersion}).`, ...r.cabala.advertencias] : []),
    ...(r.carta ? limitesDeCarta(r.carta) : []),
    ...r.omitidos.map((o) => `No incluido: ${o}`),
  ].map(textoIntegral);

  return {
    tipo: "lectura-integral",
    tradicion: ["Numerología pitagórica", r.cabala ? "cábala (gematría hebrea)" : null, r.carta ? "astrología occidental" : null].filter(Boolean).join(" · "),
    versionReglas: r.numerologia.reglasVersion,
    datosAutorizados: datos.map((d) => ({ ...d, valor: textoIntegral(d.valor), nota: d.nota && textoIntegral(d.nota) })),
    calculos: calculos.map((c) => ({
      ...c,
      subtitulo: c.subtitulo && textoIntegral(c.subtitulo),
      pasos: c.pasos.map((p) => ({ descripcion: textoIntegral(p.descripcion), operacion: textoIntegral(p.operacion) })),
    })),
    tablas: tablas.map((t) => ({ ...t, filas: t.filas.map((f) => f.map(textoIntegral)) })),
    rueda: r.carta ? ruedaDeCarta(r.carta) : undefined,
    limites,
  };
}
