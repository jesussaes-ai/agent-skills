// Regenera todos los iconos de Círculo Nueve a partir del emblema oficial (public/iconos/emblema-512.png).
// Uso: npx tsx scripts/generar-iconos.mts
// Genera: favicon.svg, favicon-16.png, favicon-32.png, favicon.ico (16/32/48/256, también para el acceso
// directo de Windows), icon.png 256, apple-icon.png 180, PWA 192/512 normales y maskable.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
// sharp llega con Next.js (optimización de imágenes); no hace falta instalarlo aparte.
import sharp from "sharp";

const RAIZ = join(import.meta.dirname, "..");
const ORIGEN = join(RAIZ, "public", "iconos", "emblema-512.png");
const MARINO = { r: 15, g: 27, b: 51, alpha: 1 };
const original = readFileSync(ORIGEN);

const png = (lado: number) => sharp(original).resize(lado, lado, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
// Maskable: el emblema ocupa el 80 % central sobre fondo marino, para que ningún recorte lo corte.
const maskable = async (lado: number) => {
  const dentro = Math.round(lado * 0.8);
  const emblema = await sharp(original).resize(dentro, dentro).png().toBuffer();
  return sharp({ create: { width: lado, height: lado, channels: 4, background: MARINO } })
    .composite([{ input: emblema, gravity: "center" }])
    .png()
    .toBuffer();
};

/** Archivo .ico con imágenes PNG dentro (válido en Windows Vista y posteriores). */
function ico(imagenes: { lado: number; datos: Buffer }[]): Buffer {
  const cabecera = Buffer.alloc(6 + 16 * imagenes.length);
  cabecera.writeUInt16LE(0, 0);
  cabecera.writeUInt16LE(1, 2);
  cabecera.writeUInt16LE(imagenes.length, 4);
  let desplazamiento = cabecera.length;
  imagenes.forEach(({ lado, datos }, i) => {
    const e = 6 + 16 * i;
    cabecera.writeUInt8(lado >= 256 ? 0 : lado, e);
    cabecera.writeUInt8(lado >= 256 ? 0 : lado, e + 1);
    cabecera.writeUInt16LE(1, e + 4);
    cabecera.writeUInt16LE(32, e + 6);
    cabecera.writeUInt32LE(datos.length, e + 8);
    cabecera.writeUInt32LE(desplazamiento, e + 12);
    desplazamiento += datos.length;
  });
  return Buffer.concat([cabecera, ...imagenes.map((x) => x.datos)]);
}

const iconos = join(RAIZ, "public", "iconos");
const app = join(RAIZ, "src", "app");
mkdirSync(iconos, { recursive: true });

const tamanos = [16, 32, 48, 180, 192, 256, 512];
const p = Object.fromEntries(await Promise.all(tamanos.map(async (t) => [t, await png(t)] as const))) as Record<number, Buffer>;

writeFileSync(join(iconos, "favicon-16.png"), p[16]);
writeFileSync(join(iconos, "favicon-32.png"), p[32]);
writeFileSync(join(iconos, "emblema-192.png"), p[192]);
writeFileSync(join(iconos, "emblema-maskable-192.png"), await maskable(192));
writeFileSync(join(iconos, "emblema-maskable-512.png"), await maskable(512));
writeFileSync(join(app, "apple-icon.png"), await maskable(180));
writeFileSync(join(app, "icon.png"), p[256]);
const archivoIco = ico([16, 32, 48, 256].map((lado) => ({ lado, datos: p[lado] })));
writeFileSync(join(app, "favicon.ico"), archivoIco);
writeFileSync(join(iconos, "circulo-nueve-escritorio.ico"), archivoIco);
// SVG: el emblema de 128 px incrustado, para navegadores que prefieren icono vectorial.
const base = (await sharp(original).resize(128, 128).png({ palette: true }).toBuffer()).toString("base64");
writeFileSync(
  join(app, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><title>Círculo Nueve</title><image width="128" height="128" href="data:image/png;base64,${base}"/></svg>\n`,
);
console.log("Iconos regenerados en public/iconos y src/app.");
