import type { Pensamiento, TipoReporte } from "../tipos";

const CN = "Círculo Nueve";

/**
 * Pensamientos por tipo de reporte. Los de origen "original" son textos propios
 * de Círculo Nueve. Los de "dominio-publico" se cotejaron con la fuente primaria
 * indicada en `referencia` (6 oct 2026); las versiones en español son
 * traducciones propias y así se imprimen. No agregar citas sin ese cotejo.
 */
export const PENSAMIENTOS: Record<TipoReporte, { recomendado: string; lista: Pensamiento[] }> = {
  numerologia: {
    recomendado: "num-01",
    lista: [
      { id: "num-01", origen: "original", autor: CN, texto: "Los números no dictan quién eres: te ofrecen un lenguaje para mirarte con calma y elegir qué palabras quieres vivir." },
      { id: "num-02", origen: "original", autor: CN, texto: "Tu nombre guarda la música con que te llamaron; escucharla de nuevo puede ser una forma de volver a casa." },
      { id: "num-03", origen: "original", autor: CN, texto: "Cada cifra es una puerta, no un muro. Tú decides cuáles abrir y cuánto tiempo quedarte." },
      { id: "num-04", origen: "original", autor: CN, texto: "Sumar, reducir, volver al origen: quizá también la vida sea un ejercicio de encontrar lo esencial." },
      { id: "num-05", origen: "original", autor: CN, texto: "Que este reporte sea un espejo amable: muestra posibilidades, y la última palabra siempre es tuya." },
      {
        id: "num-06",
        origen: "dominio-publico",
        autor: "Inscripción del templo de Apolo en Delfos",
        texto: "Conócete a ti mismo.",
        original: "γνῶθι σεαυτόν",
        referencia: "Pausanias, Descripción de Grecia, 10.24.1",
        traduccion: "Traducción tradicional",
      },
    ],
  },
  "carta-natal": {
    recomendado: "cn-01",
    lista: [
      { id: "cn-01", origen: "original", autor: CN, texto: "El cielo del día en que llegaste es un mapa, no una sentencia: señala paisajes posibles y deja el camino en tus manos." },
      { id: "cn-02", origen: "original", autor: CN, texto: "Las estrellas no tienen prisa. Lee tu carta igual: despacio, con curiosidad y sin juicio." },
      { id: "cn-03", origen: "original", autor: CN, texto: "Todo lo que vemos en el cielo ya viajó mucho para llegar a nosotros; tu historia también merece ese tiempo." },
      { id: "cn-04", origen: "original", autor: CN, texto: "Una carta natal es una fotografía del instante en que empezaste; lo que sigue lo has ido escribiendo tú." },
      { id: "cn-05", origen: "original", autor: CN, texto: "Mira hacia arriba para inspirarte y hacia dentro para decidir." },
      {
        id: "cn-06",
        origen: "dominio-publico",
        autor: "William Shakespeare",
        obra: "Julio César",
        texto: "La culpa, querido Bruto, no está en nuestras estrellas, sino en nosotros mismos.",
        original: "The fault, dear Brutus, is not in our stars, / But in ourselves, that we are underlings.",
        referencia: "Julio César, acto I, escena 2 (Project Gutenberg, libro 1522)",
        traduccion: "Traducción de Círculo Nueve (fragmento)",
      },
    ],
  },
  cabala: {
    recomendado: "cab-01",
    lista: [
      { id: "cab-01", origen: "original", autor: CN, texto: "Las letras antiguas no se descifran de una vez: se estudian, se preguntan y se dejan hablar con paciencia." },
      { id: "cab-02", origen: "original", autor: CN, texto: "Toda tradición es una conversación de siglos; acércate como quien entra a una casa ajena: con respeto y con ganas de aprender." },
      { id: "cab-03", origen: "original", autor: CN, texto: "Una buena pregunta vale más que mil respuestas apresuradas." },
      {
        id: "cab-04",
        origen: "dominio-publico",
        autor: "Hillel",
        obra: "Mishná, tratado Avot (Pirkei Avot)",
        texto: "Si yo no soy para mí, ¿quién será para mí? Y si soy solo para mí, ¿qué soy? Y si no es ahora, ¿cuándo?",
        referencia: "Pirkei Avot 1:14 (cotejado en Sefaria)",
        traduccion: "Traducción de Círculo Nueve",
      },
      {
        id: "cab-05",
        origen: "dominio-publico",
        autor: "Rabí Tarfón",
        obra: "Mishná, tratado Avot (Pirkei Avot)",
        texto: "No te corresponde terminar la obra, pero tampoco eres libre de abandonarla.",
        referencia: "Pirkei Avot 2:16 (cotejado en Sefaria)",
        traduccion: "Traducción de Círculo Nueve (fragmento)",
      },
      {
        id: "cab-06",
        origen: "dominio-publico",
        autor: "Ben Zoma",
        obra: "Mishná, tratado Avot (Pirkei Avot)",
        texto: "¿Quién es sabio? El que aprende de toda persona.",
        referencia: "Pirkei Avot 4:1 (cotejado en Sefaria)",
        traduccion: "Traducción de Círculo Nueve (fragmento)",
      },
    ],
  },
  tarot: {
    recomendado: "tar-01",
    lista: [
      { id: "tar-01", origen: "original", autor: CN, texto: "Las cartas no adivinan tu camino: te prestan imágenes para conversar contigo y escuchar lo que ya sabías." },
      { id: "tar-02", origen: "original", autor: CN, texto: "Cada arcano es una pregunta vestida de símbolo. Responde tú, sin prisa." },
      { id: "tar-03", origen: "original", autor: CN, texto: "Barajar es recordar que nada está fijo; cada tirada es un instante, no un destino." },
      { id: "tar-04", origen: "original", autor: CN, texto: "Mira la imagen, nota lo que sientes y quédate con lo que te ayude a dar el siguiente paso." },
      {
        id: "tar-05",
        origen: "dominio-publico",
        autor: "Marco Aurelio",
        obra: "Meditaciones",
        texto: "El universo es cambio; la vida, opinión.",
        referencia: "Meditaciones, libro IV, 3 (Project Gutenberg, libro 2680)",
        traduccion: "Traducción de Círculo Nueve",
      },
      {
        id: "tar-06",
        origen: "dominio-publico",
        autor: "Séneca",
        obra: "Cartas a Lucilio",
        texto: "Mientras se aplaza, la vida pasa.",
        original: "Dum differtur vita transcurrit.",
        referencia: "Epístolas morales a Lucilio, I, 3 (The Latin Library)",
        traduccion: "Traducción de Círculo Nueve",
      },
    ],
  },
  "lectura-integral": {
    recomendado: "int-01",
    lista: [
      { id: "int-01", origen: "original", autor: CN, texto: "Números, astros y letras son tres lámparas distintas; ninguna ilumina todo, juntas te invitan a mirar con más ternura." },
      { id: "int-02", origen: "original", autor: CN, texto: "Lo que aquí encuentres es una invitación a reflexionar. Lo valioso es lo que decidas hacer con ello." },
      { id: "int-03", origen: "original", autor: CN, texto: "Nueve puntos forman un círculo: ninguno es más importante que el otro, y ninguno está completo solo." },
      { id: "int-04", origen: "original", autor: CN, texto: "Vuelve a este reporte cuando lo necesites; tal vez la próxima vez te diga algo distinto, porque tú también habrás cambiado." },
      { id: "int-05", origen: "original", autor: CN, texto: "Que cada símbolo sea compañía y no carga." },
      {
        id: "int-06",
        origen: "dominio-publico",
        autor: "Sor Juana Inés de la Cruz",
        obra: "Soneto «En perseguirme, Mundo, ¿qué interesas?»",
        texto: "¿En qué te ofendo, cuando sólo intento / poner bellezas en mi entendimiento / y no mi entendimiento en las bellezas?",
        referencia: "Soneto, primer cuarteto (Wikisource en español)",
      },
    ],
  },
};

export function pensamientoDe(tipo: TipoReporte, id?: string): Pensamiento {
  const grupo = PENSAMIENTOS[tipo];
  const buscado = id ?? grupo.recomendado;
  const encontrado = grupo.lista.find((p) => p.id === buscado);
  if (!encontrado) throw new Error(`Pensamiento desconocido para ${tipo}: ${buscado}`);
  return encontrado;
}
