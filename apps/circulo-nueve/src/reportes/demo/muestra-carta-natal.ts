import { calcularCartaNatal, type LugarNacimiento } from "@/modulos/calculo/astrologia";
import { reporteDeCartaNatal } from "../adaptadores/carta-natal";
import type { DatosReporte } from "../tipos";

/** Guadalajara según GeoNames (id 4005539), como la devolvería el buscador de la app. */
export const LUGAR_MUESTRA: LugarNacimiento = {
  nombre: "Guadalajara, Jalisco, México",
  latitud: 20.6774,
  longitud: -103.3475,
  zonaHoraria: "America/Mexico_City",
  incertidumbreGrados: 0.15,
  fuente: { tipo: "geonames", geonameId: 4005539, atribucion: "Datos de lugares: GeoNames (geonames.org), licencia CC BY 4.0." },
};

/** Persona, fuentes e interpretaciones ficticias. Solo para demostración. */
export function datosMuestraCartaNatal(): DatosReporte {
  const r = calcularCartaNatal({ fecha: "1988-11-23", hora: "06:40", precisionHora: "exacta", lugar: LUGAR_MUESTRA });
  if (!r.ok) throw new Error(r.errores.join("; "));
  const base = reporteDeCartaNatal(r);
  const sol = r.posiciones.find((p) => p.clave === "sol")!;
  const luna = r.posiciones.find((p) => p.clave === "luna")!;

  return {
    ...base,
    titulo: "Carta natal",
    nombrePersona: "Valeria Inés Montaño Ríos",
    folio: "CN-DEMO-0002",
    fechaElaboracion: "2026-10-06",
    demostracion: true,
    datosAutorizados: [{ etiqueta: "Nombre preferido", valor: "Vale" }, ...base.datosAutorizados],
    interpretaciones: [
      {
        titulo: `El Sol en ${sol.signo}`,
        origen: "tradicional",
        parrafos: [
          `Texto de ejemplo. En muchas obras de astrología occidental, el Sol en ${sol.signo} se asocia con la búsqueda de sentido y con el deseo de ampliar horizontes.`,
          "Puede leerse como una invitación a notar qué experiencias te hacen sentir con más energía y cuáles te piden pausa.",
        ],
        citas: [
          { fuenteId: "f1", localizador: { capitulo: "4", paginaImpresa: "63" }, tipo: "parafrasis" },
          { fuenteId: "f2", localizador: { seccion: "El Sol en los signos", paginaImpresa: "21" }, tipo: "sintesis" },
        ],
        preguntas: ["¿Qué te ha abierto el horizonte en el último año?"],
      },
      {
        titulo: `La Luna en ${luna.signo}`,
        origen: "tradicional",
        parrafos: [
          `Texto de ejemplo. Algunas tradiciones vinculan la Luna en ${luna.signo} con la forma de buscar refugio y de cuidar lo propio.`,
        ],
        citas: [
          { fuenteId: "f1", localizador: { capitulo: "6", paginaImpresa: "98" }, tipo: "textual" },
          { fuenteId: "f3", localizador: { paginaImpresa: "14" }, tipo: "parafrasis" },
        ],
      },
      {
        titulo: "Una mirada de conjunto",
        origen: "ia",
        generadoPor: "Modelo de demostración · sin proveedor real",
        parrafos: [
          "Texto de ejemplo generado para la demostración. Al mirar juntos el Sol, la Luna y el Ascendente aparece una posible conversación entre el impulso de explorar y la necesidad de un lugar seguro al cual volver. No es una conclusión sobre quién eres: es una pregunta que puedes explorar a tu manera.",
        ],
        citas: [{ fuenteId: "f4", localizador: { url: "https://ejemplo.invalid/astrologia" }, tipo: "sintesis" }],
        preguntas: ["¿Dónde sientes hoy ese lugar seguro?"],
      },
    ],
    limites: [...base.limites, "Las interpretaciones de esta muestra son textos de ejemplo y las fuentes son ficticias."],
    fuentes: [
      { id: "f1", titulo: "Manual de astrología (fuente ficticia de demostración)", autor: "Autora de ejemplo", referencia: "Editorial de ejemplo", edicion: "2.ª ed.", grupo: "aportada" },
      { id: "f2", titulo: "Cuaderno de estudio de los signos (ficticio)", autor: "Autor de ejemplo", referencia: "Archivo del propietario", grupo: "aportada" },
      { id: "f3", titulo: "Notas de curso (ficticias)", referencia: "Archivo del propietario", grupo: "aportada" },
      { id: "f4", titulo: "Artículo web de ejemplo", referencia: "https://ejemplo.invalid/astrologia", fechaConsulta: "2026-10-06", grupo: "complementaria" },
    ],
    objetivoAportadas: 0.8,
    avisoPrivacidad: {},
  };
}
