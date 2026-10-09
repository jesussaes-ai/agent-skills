/**
 * Genera el hash argon2id de la clave de alta para ADMIN_SETUP_KEY_HASH.
 *
 *   npm run setup:hash                 # escribe la clave (no se muestra) y pulsa Enter
 *   npm run setup:hash -- --generar    # genera una clave aleatoria y la muestra UNA vez
 *
 * La clave nunca se guarda. Para rotarla antes del alta: genera otro hash y
 * reemplaza el secreto. Tras el alta, la clave deja de servir.
 */
import { randomBytes } from "node:crypto";
import { generarHashClaveAlta, LONGITUD_MINIMA_CLAVE } from "../src/modulos/auth/clave-alta.ts";

async function leerClaveOculta(): Promise<string> {
  if (!process.stdin.isTTY) {
    const partes: Buffer[] = [];
    for await (const p of process.stdin) partes.push(p as Buffer);
    return Buffer.concat(partes).toString("utf8").trim();
  }
  process.stderr.write(`Clave de alta (mínimo ${LONGITUD_MINIMA_CLAVE} caracteres): `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  let clave = "";
  return new Promise((resolver) => {
    process.stdin.on("data", (b: Buffer) => {
      for (const c of b.toString("utf8")) {
        if (c === "\r" || c === "\n") {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stderr.write("\n");
          resolver(clave);
          return;
        }
        if (c === "\u0003") process.exit(130);
        clave = c === "\u007f" ? clave.slice(0, -1) : clave + c;
      }
    });
  });
}

const generar = process.argv.includes("--generar");
const clave = generar ? randomBytes(24).toString("base64url") : await leerClaveOculta();
const hash = await generarHashClaveAlta(clave);

if (generar) {
  process.stderr.write("Clave de alta generada (guárdala en un gestor de contraseñas; no se volverá a mostrar):\n");
  process.stderr.write(`${clave}\n\n`);
}
process.stderr.write("Carga este valor como secreto ADMIN_SETUP_KEY_HASH (en .env.local o en el hosting):\n");
process.stdout.write(`${hash}\n`);
