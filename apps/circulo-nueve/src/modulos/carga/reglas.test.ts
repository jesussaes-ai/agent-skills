import { describe, expect, it } from "vitest";
import { EXTENSIONES, LIMITES } from "@/modulos/biblioteca/formatos";
import { REGLAS_FRECUENCIA } from "@/modulos/seguridad/reglas";
import {
  ACEPTA_IMAGENES,
  REGLAS_CARGA,
  aceptaDe,
  mimeDe,
  nombreSeguro,
  tamanoLegible,
  tituloParaArchivo,
  validarArchivo,
} from "./reglas";

const MB = 1024 * 1024;

describe("reglas de carga", () => {
  it("la biblioteca acepta exactamente las extensiones y límites del pipeline de ingesta", () => {
    expect([...REGLAS_CARGA.biblioteca.extensiones].sort()).toEqual(Object.values(EXTENSIONES).flat().sort());
    expect(REGLAS_CARGA.biblioteca.bytesMaximo).toBe(LIMITES.bytesCargaDirecta);
    expect(REGLAS_CARGA.biblioteca.bytesImagen).toBe(LIMITES.bytesImagen);
  });

  it("el expediente solo acepta PDF y fotos, como el bucket privado (25 MB)", () => {
    expect(aceptaDe("expediente")).toBe(".pdf,.jpg,.jpeg,.png,.webp");
    expect(REGLAS_CARGA.expediente.bytesMaximo).toBe(25 * MB);
    expect(validarArchivo("expediente", { name: "acta.docx", size: 10 })).toMatch(/no se admite/);
    expect(validarArchivo("expediente", { name: "INE.JPG", size: 3 * MB })).toBeNull();
    expect(validarArchivo("expediente", { name: "escaneo.pdf", size: 24 * MB })).toBeNull();
    expect(validarArchivo("expediente", { name: "escaneo.pdf", size: 26 * MB })).toMatch(/máximo es 25\.0 MB/);
  });

  it("rechaza vacíos, fotos HEIC, sin extensión e imágenes de más de 10 MB", () => {
    expect(validarArchivo("biblioteca", { name: "a.pdf", size: 0 })).toBe("El archivo está vacío.");
    expect(validarArchivo("biblioteca", { name: "IMG_0001.HEIC", size: 2 * MB })).toMatch(/HEIC/);
    expect(validarArchivo("biblioteca", { name: "sin-extension", size: 5 })).toMatch(/sin extensión/);
    expect(validarArchivo("biblioteca", { name: "foto.jpg", size: 11 * MB })).toMatch(/máximo es 10\.0 MB/);
    expect(validarArchivo("biblioteca", { name: "libro.pdf", size: 49 * MB })).toBeNull();
    expect(validarArchivo("biblioteca", { name: "libro.pdf", size: 51 * MB })).toMatch(/máximo es 50\.0 MB/);
  });

  it("la cámara y la galería piden formatos que el teléfono convierte a JPEG", () => {
    expect(ACEPTA_IMAGENES.split(",")).toEqual(["image/jpeg", "image/png", "image/webp"]);
    expect(mimeDe("foto.JPG")).toBe("image/jpeg");
    expect(mimeDe("raro.xyz")).toBe("application/octet-stream");
  });

  it("titula cada archivo: nombre del archivo si no hay título y numeración con varios", () => {
    expect(tituloParaArchivo("", "pagina_12.jpg", 0, 3)).toBe("pagina 12");
    expect(tituloParaArchivo("Lunario", "image.jpg", 0, 1)).toBe("Lunario");
    expect(tituloParaArchivo("Lunario", "image.jpg", 1, 3)).toBe("Lunario (2 de 3)");
    expect(tituloParaArchivo("x".repeat(400), "a.pdf", 0, 1)).toHaveLength(300);
  });

  it("limpia nombres con rutas o caracteres de control", () => {
    expect(nombreSeguro("C:\\fotos\\acta.pdf")).toBe("acta.pdf");
    expect(nombreSeguro("../../etc/pas\u0000swd.jpg")).toBe("passwd.jpg");
    expect(nombreSeguro("   ")).toBe("archivo");
  });

  it("muestra tamaños legibles y tiene límite de frecuencia para subir documentos", () => {
    expect(tamanoLegible(512)).toBe("512 B");
    expect(tamanoLegible(2048)).toBe("2 KB");
    expect(tamanoLegible(3.5 * MB)).toBe("3.5 MB");
    expect(REGLAS_FRECUENCIA.subirDocumento.maximo).toBeGreaterThan(0);
  });
});
