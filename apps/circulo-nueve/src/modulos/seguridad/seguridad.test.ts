import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { crearLimiteIntentos } from "@/modulos/auth/limite-intentos";
import { REGLAS_FRECUENCIA, claveLimite, ipDe, ipRecortada, mensajeEspera } from "./reglas";

const RAIZ = join(__dirname, "..", "..", "..");

function archivos(dir: string, extensiones: RegExp): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "node_modules" || nombre.startsWith(".") ? [] : archivos(ruta, extensiones);
    return extensiones.test(nombre) ? [ruta] : [];
  });
}

const CODIGO = archivos(join(RAIZ, "src"), /\.(ts|tsx)$/).filter((f) => !/\.test\.ts$|\/pruebas\/|\/demo\//.test(f));
const SCRIPTS = archivos(join(RAIZ, "scripts"), /\.(mts|ts|mjs|sh)$/).filter((f) => !f.includes("referencias-astrologia"));
const leer = (f: string) => readFileSync(f, "utf8");
const rel = (f: string) => relative(RAIZ, f);

describe("límites de frecuencia", () => {
  it("la clave guardada es un hash que no contiene la IP ni el usuario", () => {
    const clave = claveLimite("entrar", "201.141.23.45|ana");
    expect(clave).toMatch(/^[0-9a-f]{64}$/);
    expect(clave).not.toContain("201.141");
    expect(clave).not.toBe(claveLimite("mfa", "201.141.23.45|ana"));
  });

  it("login y endpoints sensibles tienen regla", () => {
    for (const regla of ["entrar", "alta", "mfa", "descargarDocumento", "exportar", "generarPdf", "crearEnlace", "enlacePublico", "asistente", "biblioteca"]) {
      expect(REGLAS_FRECUENCIA).toHaveProperty(regla);
    }
    expect(REGLAS_FRECUENCIA.entrar.maximo).toBeLessThanOrEqual(10);
  });

  it("IP del cliente y versión recortada para la auditoría", () => {
    expect(ipDe(new Headers({ "x-forwarded-for": "201.141.23.45, 10.0.0.1" }))).toBe("201.141.23.45");
    expect(ipDe(new Headers())).toBe("local");
    expect(ipRecortada("201.141.23.45")).toBe("201.141.23.0/24");
    expect(ipRecortada("2806:2f0:9000:1234::1")).toBe("2806:2f0:9000::/48");
    expect(ipRecortada("local")).toBeNull();
  });

  it("el respaldo en memoria consulta sin contar y bloquea al llegar al máximo", () => {
    let t = 0;
    const limite = crearLimiteIntentos(2, 1000, () => t);
    expect(limite.consultar("x").permitido).toBe(true);
    limite.registrar("x");
    limite.registrar("x");
    expect(limite.consultar("x")).toEqual({ permitido: false, reintentarEnMs: 1000 });
    t = 1000;
    expect(limite.consultar("x").permitido).toBe(true);
  });

  it("mensaje de espera legible", () => {
    expect(mensajeEspera(1)).toBe("Demasiados intentos. Vuelve a intentarlo en 1 segundo.");
    expect(mensajeEspera(30)).toContain("30 segundos");
    expect(mensajeEspera(600)).toContain("10 minutos");
  });
});

describe("lista de seguridad (revisión automática del código)", () => {
  it("ninguna variable pública (NEXT_PUBLIC_) lleva secretos", () => {
    const publicas = new Set<string>();
    for (const f of [...CODIGO, ...SCRIPTS, join(RAIZ, ".env.example")]) {
      for (const m of leer(f).matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) publicas.add(m[0]);
    }
    const permitidas = new Set(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SITE_URL"]);
    expect([...publicas].filter((v) => !permitidas.has(v))).toEqual([]);
  });

  it("la llave de servicio solo se usa en código de servidor", () => {
    const usos = CODIGO.filter((f) => /SUPABASE_SERVICE_ROLE_KEY|clienteSupabaseAdmin\(/.test(leer(f)));
    expect(usos.length).toBeGreaterThan(0);
    expect(usos.filter((f) => /^"use client";/m.test(leer(f))).map(rel)).toEqual([]);
    const modulos = usos.filter((f) => !/^"use server";/m.test(leer(f))).map((f) => rel(f).replace(/^src\//, "@/").replace(/\.tsx?$/, ""));
    const clientes = CODIGO.filter((f) => /^"use client";/m.test(leer(f)));
    const importan = clientes.filter((f) => modulos.some((m) => new RegExp(`^import (?!type )[^;]*from "${m}"`, "m").test(leer(f))));
    expect(importan.map(rel)).toEqual([]);
  });

  it("los componentes de cliente no importan módulos con secretos", () => {
    const clientes = CODIGO.filter((f) => /^"use client";/m.test(leer(f)));
    const malos = clientes.filter((f) => /from "@\/modulos\/auth\/supabase-servidor"|from "node:crypto"|process\.env\.(?!NEXT_PUBLIC_)/.test(leer(f)));
    expect(malos.map(rel)).toEqual([]);
  });

  it("la app no escribe registros en consola (los logs no pueden filtrar datos)", () => {
    expect(CODIGO.filter((f) => /\bconsole\.(log|info|warn|error|debug)\(/.test(leer(f))).map(rel)).toEqual([]);
  });

  it("los scripts no imprimen llaves, tokens ni contraseñas", () => {
    const sospechoso = /(console\.\w+|process\.(stdout|stderr)\.write)\([^\n]*\$\{[^}]*(process\.env|service|token|secret|password|contrasena)/i;
    expect(SCRIPTS.filter((f) => sospechoso.test(leer(f))).map(rel)).toEqual([]);
  });

  it("los archivos de entorno locales no se suben al repositorio", () => {
    const ignorados = leer(join(RAIZ, ".gitignore"));
    expect(ignorados).toMatch(/^\.env$/m);
    expect(ignorados).toMatch(/^\.env\*\.local$/m);
    for (const linea of leer(join(RAIZ, ".env.example")).split("\n")) {
      if (/^(SUPABASE_SERVICE_ROLE_KEY|ADMIN_SETUP_KEY_HASH|LLM_KEY_\w+|LLM_API_KEY)=/.test(linea)) expect(linea).toMatch(/=$/);
    }
  });

  it("cada tabla nueva de las migraciones activa RLS", () => {
    const sql = archivos(join(RAIZ, "supabase", "migrations"), /\.sql$/).map(leer).join("\n");
    const tablas = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);
    const sinRls = tablas.filter((t) => !new RegExp(`alter table public\\.${t} enable row level security`).test(sql));
    expect(sinRls).toEqual([]);
  });

  it("los enlaces compartidos guardan el hash, nunca el token", () => {
    const acciones = leer(join(RAIZ, "src", "modulos", "compartir", "acciones.ts"));
    expect(acciones).toMatch(/token_hash: hash/);
    expect(acciones).not.toMatch(/token_hash: token/);
  });
});
