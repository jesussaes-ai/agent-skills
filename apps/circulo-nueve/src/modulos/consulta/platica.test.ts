import { describe, expect, it } from "vitest";
import { analizarPlatica } from "./platica";

describe("analizarPlatica: plática completa", () => {
  it("encuentra los cuatro datos en una plática larga mezclada con otras frases", () => {
    const r = analizarPlatica(
      "Hola, buenas tardes. Mi nombre completo es ana maría núñez de la cruz y vengo porque quiero entender mejor mi camino. " +
        "Nací en Guadalajara, Jalisco el 15 de julio de 1990, como a las 8:30 de la mañana según mi mamá. " +
        "Ahora vivo en Monterrey y trabajo como maestra.",
    );
    expect(r.nombre).toBe("Ana María Núñez de la Cruz");
    expect(r.fecha).toBe("1990-07-15");
    expect(r.hora).toBe("08:30");
    expect(r.precisionHora).toBe("aproximada");
    expect(r.lugar).toBe("Guadalajara, Jalisco");
    expect(r.faltan).toEqual([]);
    expect(r.hallazgos.map((h) => h.campo)).toEqual(["nombre", "fecha", "hora", "lugar"]);
    expect(r.hallazgos.find((h) => h.campo === "hora")?.fragmento).toMatch(/como a las 8:30/);
  });

  it("texto sin datos: faltan los cuatro y no se inventa nada", () => {
    const r = analizarPlatica("Hola, quiero saber qué significa mi número y cómo me va a ir este año.");
    expect(r.faltan).toEqual(["nombre", "fecha", "hora", "lugar"]);
    expect(r.nombre).toBeUndefined();
    expect(r.fecha).toBeUndefined();
    expect(r.hora).toBeUndefined();
    expect(r.lugar).toBeUndefined();
    expect(r.precisionHora).toBe("desconocida");
    expect(r.hallazgos).toEqual([]);
  });
});

describe("nombre", () => {
  it("«me llamo …» se corta en «y» y en la coma", () => {
    expect(analizarPlatica("Me llamo José Luis Pérez y tengo 40 años").nombre).toBe("José Luis Pérez");
    expect(analizarPlatica("me llamo carlos, gracias").nombre).toBe("Carlos");
  });

  it("«nombre: …» y máximo seis palabras", () => {
    expect(analizarPlatica("Nombre: María Guadalupe Hernández López").nombre).toBe("María Guadalupe Hernández López");
    expect(analizarPlatica("me llamo uno dos tres cuatro cinco seis siete").nombre).toBe("Uno Dos Tres Cuatro Cinco Seis");
  });

  it("«soy …» solo con mayúscula; «soy de …» es lugar, no nombre", () => {
    expect(analizarPlatica("Soy Roberto Gómez Bolaños.").nombre).toBe("Roberto Gómez Bolaños");
    const r = analizarPlatica("soy maestra y soy de Puebla.");
    expect(r.nombre).toBeUndefined();
    expect(r.lugar).toBe("Puebla");
  });
});

describe("fecha", () => {
  it("formato día/mes/año con diagonal o guion, y formato ISO", () => {
    expect(analizarPlatica("nací el 05/11/1985").fecha).toBe("1985-11-05");
    expect(analizarPlatica("fecha 15-07-1990").fecha).toBe("1990-07-15");
    expect(analizarPlatica("mi fecha es 1990-07-15").fecha).toBe("1990-07-15");
  });

  it("años de dos dígitos: «del 85» → 1985 y «del 05» → 2005", () => {
    expect(analizarPlatica("el 3 de marzo del 85").fecha).toBe("1985-03-03");
    expect(analizarPlatica("nací el 3 de marzo del 05").fecha).toBe("2005-03-03");
  });

  it("meses con mayúscula y «setiembre»", () => {
    expect(analizarPlatica("Nací el 1 de Enero de 2001").fecha).toBe("2001-01-01");
    expect(analizarPlatica("el 9 de setiembre de 1970").fecha).toBe("1970-09-09");
  });

  it("descarta fechas imposibles o fuera de rango", () => {
    expect(analizarPlatica("nací el 31/02/1990").fecha).toBeUndefined();
    expect(analizarPlatica("el 31 de febrero de 1990").fecha).toBeUndefined();
    expect(analizarPlatica("el 1 de enero de 1700").fecha).toBeUndefined();
    expect(analizarPlatica("el 31/02/1990 no, perdón, el 28/02/1990").fecha).toBe("1990-02-28");
  });
});

describe("hora", () => {
  it("exacta: «a las 8:30», «8:30 pm», «a las 20 horas», «a las 3 de la madrugada»", () => {
    expect(analizarPlatica("nací a las 8:30").hora).toBe("08:30");
    expect(analizarPlatica("a las 8:30 pm").hora).toBe("20:30");
    const r = analizarPlatica("nací a las 20 horas");
    expect(r.hora).toBe("20:00");
    expect(r.precisionHora).toBe("exacta");
    expect(analizarPlatica("a las 3 de la madrugada").hora).toBe("03:00");
    expect(analizarPlatica("a las 4:15 de la tarde").hora).toBe("16:15");
  });

  it("aproximada: «como a las 8», «alrededor de las 7», «más o menos a las 6 de la tarde»", () => {
    for (const [texto, hora] of [
      ["nací como a las 8", "08:00"],
      ["alrededor de las 7", "07:00"],
      ["más o menos a las 6 de la tarde", "18:00"],
      ["a las 11 de la noche aproximadamente", "23:00"],
    ] as const) {
      const r = analizarPlatica(texto);
      expect(r.hora, texto).toBe(hora);
      expect(r.precisionHora, texto).toBe("aproximada");
    }
  });

  it("mediodía y medianoche", () => {
    expect(analizarPlatica("nací al mediodía").hora).toBe("12:00");
    expect(analizarPlatica("nací a medianoche").hora).toBe("00:00");
  });

  it("desconocida: se reconoce pero no hay hora y no falta el campo", () => {
    for (const texto of ["no sé la hora", "No se a qué hora nací", "sin hora, lo siento"]) {
      const r = analizarPlatica(texto);
      expect(r.hora, texto).toBeUndefined();
      expect(r.precisionHora, texto).toBe("desconocida");
      expect(r.faltan, texto).not.toContain("hora");
      expect(r.hallazgos[0]).toMatchObject({ campo: "hora", valor: "desconocida" });
    }
  });
});

describe("lugar", () => {
  it("«nací en …» no confunde «nací el 15…»", () => {
    const r = analizarPlatica("Nací el 15 de julio de 1990 en la ciudad de León, Guanajuato.");
    expect(r.lugar).toBe("León, Guanajuato");
    expect(r.fecha).toBe("1990-07-15");
  });

  it("se corta en «el», «a las» y «en el año»", () => {
    expect(analizarPlatica("nací en Oaxaca de Juárez el 2 de mayo").lugar).toBe("Oaxaca de Juárez");
    expect(analizarPlatica("nací en Mérida a las 5").lugar).toBe("Mérida");
    expect(analizarPlatica("nací en Tijuana en el año 2000").lugar).toBe("Tijuana");
  });

  it("«originaria de …» y «soy de …»", () => {
    expect(analizarPlatica("Soy originaria de San Cristóbal de las Casas, Chiapas.").lugar).toBe("San Cristóbal de las Casas, Chiapas");
    expect(analizarPlatica("soy de Querétaro").lugar).toBe("Querétaro");
  });

  it("«nací en 1990» no es un lugar", () => {
    const r = analizarPlatica("nací en 1990");
    expect(r.lugar).toBeUndefined();
    expect(r.faltan).toContain("lugar");
  });
});

describe("lugar después de la fecha y la hora", () => {
  it("«nací el 23 de noviembre de 1988 como a las 6:40 de la mañana en Guadalajara»", () => {
    const a = analizarPlatica("Me llamo Ana María Núñez, mi mamá dice que nací el 23 de noviembre de 1988 como a las 6:40 de la mañana en Guadalajara. Ahorita estoy pasando por un cambio.");
    expect(a.lugar).toBe("Guadalajara");
    expect(a.fecha).toBe("1988-11-23");
    expect(a.hora).toBe("06:40");
    expect(a.precisionHora).toBe("aproximada");
    expect(a.faltan).toEqual([]);
  });
});
