/** Tokens visuales de los reportes PDF. Colores tomados del logotipo oficial. */
export const COLORES = {
  marino: "#00172E",
  marinoProfundo: "#051924",
  marinoSuave: "#1B3150",
  dorado: "#D4A64E",
  doradoClaro: "#F0D088",
  /** Dorado oscurecido: único tono dorado apto para texto sobre marfil (contraste ≥ 4.5:1). */
  doradoTexto: "#7A5A16",
  marfil: "#FBF8F1",
  pergamino: "#F3ECDD",
  linea: "#E4D8BE",
  pizarra: "#46505E",
  blanco: "#FFFFFF",
  /** Etiqueta de contenido generado por IA: distinto del dorado para no confundirlo con lo tradicional. */
  ia: "#2E5E66",
  iaFondo: "#E6F0F0",
  aviso: "#8A3B12",
  avisoFondo: "#FBEDE3",
} as const;

export const TIPOGRAFIA = {
  titulos: "Cormorant Garamond",
  texto: "Source Sans 3",
  tamanos: {
    portada: 34,
    h1: 22,
    h2: 15,
    cuerpo: 10,
    pequeno: 8.5,
    micro: 7,
    pensamiento: 15,
  },
} as const;

export const PAGINA = {
  tamano: "LETTER" as const,
  /** Alto de carta en puntos; el pie se ancla con `top`. */
  alto: 792,
  margen: 54,
  margenSuperior: 78,
  margenInferior: 64,
};
