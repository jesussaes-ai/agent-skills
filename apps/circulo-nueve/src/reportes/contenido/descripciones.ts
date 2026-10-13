import type { TipoReporte } from "../tipos";

export interface DescripcionReporte {
  nombre: string;
  /** Línea breve bajo el título de portada. */
  lema: string;
  /** Descripción de portada (2–3 frases). */
  descripcion: string;
}

export const DESCRIPCIONES: Record<TipoReporte, DescripcionReporte> = {
  numerologia: {
    nombre: "Lectura de numerología",
    lema: "El lenguaje de los números de tu nombre y tu fecha",
    descripcion:
      "Esta lectura traduce las letras de tu nombre de nacimiento y los dígitos de tu fecha a números, paso a paso y a la vista. Es una invitación a reflexionar sobre tus ritmos y talentos desde una tradición simbólica, no una predicción ni un diagnóstico.",
  },
  "carta-natal": {
    nombre: "Carta natal",
    lema: "El cielo del instante y el lugar en que naciste",
    descripcion:
      "Tu carta natal muestra la posición del Sol, la Luna y los planetas en el momento y el lugar de tu nacimiento. La leemos como un mapa simbólico para conversar contigo; su precisión depende de los datos de hora y lugar, que aquí se indican con claridad.",
  },
  cabala: {
    nombre: "Lectura de cábala",
    lema: "Letras, números y preguntas de una tradición milenaria",
    descripcion:
      "Esta lectura se acerca a la tradición elegida con respeto por su historia y sus fuentes. Indica qué es documentado y qué es comentario, y nunca mezcla escuelas sin decirlo, para que puedas estudiar con confianza.",
  },
  tarot: {
    nombre: "Lectura de tarot",
    lema: "Imágenes para conversar contigo",
    descripcion:
      "Las cartas de esta tirada son símbolos para la reflexión: cada una abre preguntas sobre el momento que vives. No anticipan el futuro; te acompañan a mirar tus opciones con más claridad.",
  },
  "lectura-integral": {
    nombre: "Lectura integral",
    lema: "Números, astros y letras en un mismo círculo",
    descripcion:
      "Reunimos en un solo documento las lecturas que autorizaste, cada una en su sección y con su propia tradición. Así puedes ver coincidencias y contrastes sin perder de vista de dónde viene cada idea.",
  },
};
