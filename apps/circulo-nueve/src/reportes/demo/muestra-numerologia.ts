import { calcularNumerologia } from "@/modulos/calculo/numerologia";
import { reporteDeNumerologia } from "../adaptadores/numerologia";
import type { DatosReporte } from "../tipos";

/** Persona, fuentes e interpretaciones ficticias. Solo para demostración. */
export function datosMuestraNumerologia(): DatosReporte {
  const r = calcularNumerologia({ nombre: "Valeria Inés Montaño Ríos", fecha: "1988-11-23" });
  if (!r.ok) throw new Error(r.errores.join("; "));
  const base = reporteDeNumerologia(r);
  const camino = r.indicadores.find((i) => i.clave === "caminoDeVida")?.valor;
  const expresion = r.indicadores.find((i) => i.clave === "expresion")?.valor;

  return {
    ...base,
    titulo: "Lectura de numerología",
    nombrePersona: "Valeria Inés Montaño Ríos",
    folio: "CN-DEMO-0001",
    fechaElaboracion: "2026-10-06",
    demostracion: true,
    datosAutorizados: [
      ...base.datosAutorizados,
      { etiqueta: "Nombre preferido", valor: "Vale" },
      { etiqueta: "Profundidad de lectura", valor: "Esencial" },
    ],
    interpretaciones: [
      {
        titulo: `Camino de vida ${camino}`,
        origen: "tradicional",
        parrafos: [
          "Texto de ejemplo. En la tradición pitagórica, este número suele asociarse con la búsqueda de equilibrio entre la propia voz y el cuidado de los demás.",
          "Puede leerse como una invitación a reconocer en qué momentos te sientes en armonía y qué decisiones te acercan a ellos.",
        ],
        citas: [
          { fuenteId: "f1", localizador: { capitulo: "3", paginaImpresa: "41" }, tipo: "parafrasis" },
          { fuenteId: "f2", localizador: { seccion: "Camino de vida", paginaImpresa: "12" }, tipo: "sintesis" },
        ],
        preguntas: ["¿En qué situaciones recientes sentiste que encontrabas tu propio ritmo?"],
      },
      {
        titulo: `Expresión ${expresion}`,
        origen: "tradicional",
        parrafos: [
          "Texto de ejemplo. Algunas obras relacionan este valor con la manera en que una persona comparte sus talentos con el entorno.",
        ],
        citas: [
          { fuenteId: "f1", localizador: { capitulo: "5", paginaImpresa: "77" }, tipo: "textual" },
          { fuenteId: "f1", localizador: { capitulo: "3", paginaImpresa: "41" }, tipo: "parafrasis" },
          { fuenteId: "f2", localizador: { seccion: "Expresión", paginaImpresa: "19" }, tipo: "parafrasis" },
        ],
      },
      {
        titulo: "Una mirada de conjunto",
        origen: "ia",
        generadoPor: "Modelo de demostración · sin proveedor real",
        parrafos: [
          "Texto de ejemplo generado para la demostración. Al combinar los números de tu fecha y tu nombre, aparece una posible conversación entre la necesidad de expresarte y el deseo de construir lazos estables. No es una conclusión sobre quién eres: es una pregunta que puedes explorar a tu manera.",
        ],
        citas: [
          { fuenteId: "f3", localizador: { paginaImpresa: "8" }, tipo: "sintesis" },
          { fuenteId: "f4", localizador: { url: "https://ejemplo.invalid/numerologia" }, tipo: "sintesis" },
        ],
        preguntas: ["¿Qué te gustaría expresar más este año?", "¿Qué vínculos te sostienen cuando cambias?"],
      },
    ],
    limites: [
      ...base.limites,
      "La numerología es un sistema simbólico de reflexión personal; no es un hecho científico, diagnóstico ni predicción.",
      "Las interpretaciones de esta muestra son textos de ejemplo y las fuentes son ficticias.",
    ],
    fuentes: [
      { id: "f1", titulo: "Manual de numerología (fuente ficticia de demostración)", autor: "Autora de ejemplo", referencia: "Editorial de ejemplo", edicion: "1.ª ed.", grupo: "aportada" },
      { id: "f2", titulo: "Cuaderno de estudio pitagórico (ficticio)", autor: "Autor de ejemplo", referencia: "Archivo del propietario", grupo: "aportada" },
      { id: "f3", titulo: "Notas de curso (ficticias)", referencia: "Archivo del propietario", grupo: "aportada" },
      { id: "f4", titulo: "Artículo web de ejemplo", referencia: "https://ejemplo.invalid/numerologia", fechaConsulta: "2026-10-06", grupo: "complementaria" },
    ],
    objetivoAportadas: 0.8,
    avisoPrivacidad: {},
  };
}
