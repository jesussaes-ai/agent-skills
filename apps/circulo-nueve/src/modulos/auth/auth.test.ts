import { describe, expect, it } from "vitest";
import { generarHashClaveAlta, verificarClaveAlta } from "./clave-alta";
import { leerConfigSupabase, origenPublico, rutaInternaSegura } from "./config";
import { esquemaAlta, esquemaInvitar, esquemaNuevaContrasena } from "./esquemas";
import { crearLimiteIntentos } from "./limite-intentos";

const CLAVE = "clave-de-prueba-larga-0123456789";

describe("clave de alta", () => {
  it("genera un hash argon2id que no contiene la clave", async () => {
    const h = await generarHashClaveAlta(CLAVE);
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(h).not.toContain(CLAVE);
  });

  it("acepta solo la clave correcta", async () => {
    const h = await generarHashClaveAlta(CLAVE);
    expect(await verificarClaveAlta(CLAVE, h)).toBe(true);
    expect(await verificarClaveAlta(`${CLAVE}x`, h)).toBe(false);
    expect(await verificarClaveAlta("", h)).toBe(false);
  });

  it("rechaza si no hay hash o no es argon2id", async () => {
    expect(await verificarClaveAlta(CLAVE, undefined)).toBe(false);
    expect(await verificarClaveAlta(CLAVE, "texto-plano")).toBe(false);
    expect(await verificarClaveAlta(CLAVE, CLAVE)).toBe(false);
  });

  it("exige claves largas", async () => {
    await expect(generarHashClaveAlta("corta")).rejects.toThrow();
  });
});

describe("límite de intentos", () => {
  it("bloquea al superar el máximo y libera al pasar la ventana", () => {
    let t = 0;
    const l = crearLimiteIntentos(2, 1000, () => t);
    expect(l.registrar("ip").permitido).toBe(true);
    expect(l.registrar("ip").permitido).toBe(true);
    const bloqueado = l.registrar("ip");
    expect(bloqueado.permitido).toBe(false);
    expect(bloqueado.reintentarEnMs).toBe(1000);
    expect(l.registrar("otra-ip").permitido).toBe(true);
    t = 1001;
    expect(l.registrar("ip").permitido).toBe(true);
  });
});

describe("configuración y redirecciones", () => {
  it("queda en modo demo sin variables", () => {
    expect(leerConfigSupabase({}).configurado).toBe(false);
    expect(leerConfigSupabase({ NEXT_PUBLIC_SUPABASE_URL: "http://x", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k" }).configurado).toBe(true);
  });

  it.each([
    ["/admin/usuarios", "/admin/usuarios"],
    ["//evil.example", "/cuenta"],
    ["https://evil.example", "/cuenta"],
    ["/\\evil", "/cuenta"],
    [null, "/cuenta"],
  ])("rutaInternaSegura(%s) = %s", (entrada, esperado) => {
    expect(rutaInternaSegura(entrada)).toBe(esperado);
  });
});

describe("validación de formularios", () => {
  it("exige contraseñas de 10+ caracteres con letras y números", () => {
    expect(esquemaNuevaContrasena.safeParse({ contrasena: "corta1", confirmacion: "corta1" }).success).toBe(false);
    expect(esquemaNuevaContrasena.safeParse({ contrasena: "sololetrasaqui", confirmacion: "sololetrasaqui" }).success).toBe(false);
    expect(esquemaNuevaContrasena.safeParse({ contrasena: "Valida12345", confirmacion: "Valida12345" }).success).toBe(true);
  });

  it("detecta confirmaciones distintas", () => {
    const r = esquemaAlta.safeParse({ clave: "x", correo: "a@b.mx", nombre: "A", contrasena: "Valida12345", confirmacion: "Otra12345678" });
    expect(r.success).toBe(false);
  });

  it("normaliza el correo y limita los roles", () => {
    expect(esquemaInvitar.parse({ correo: " Ana@Demo.MX ", nombre: "Ana", rol: "consultor" }).correo).toBe("ana@demo.mx");
    expect(esquemaInvitar.safeParse({ correo: "a@b.mx", nombre: "A", rol: "superadmin" }).success).toBe(false);
  });
});

describe("origen público", () => {
  it("usa NEXT_PUBLIC_SITE_URL si existe", () => {
    expect(origenPublico(new Headers({ host: "otro:1" }), { NEXT_PUBLIC_SITE_URL: "https://circulo.example/" })).toBe("https://circulo.example");
  });
  it("si no, usa el host que envió el navegador", () => {
    expect(origenPublico(new Headers({ host: "127.0.0.1:3000" }), {})).toBe("http://127.0.0.1:3000");
    expect(origenPublico(new Headers({ "x-forwarded-host": "app.example", "x-forwarded-proto": "https" }), {})).toBe("https://app.example");
  });
});
