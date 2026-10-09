import { describe, expect, it } from "vitest";
import { generarHashClaveAlta, verificarClaveAlta } from "./clave-alta";
import { leerConfigSupabase, origenPublico, rutaInternaSegura } from "./config";
import { esquemaAlta, esquemaCrearCuenta, esquemaEntrar, esquemaNuevaContrasena } from "./esquemas";
import { correoInterno, esCorreoInterno, generarContrasenaInicial, normalizarUsuario } from "./usuarios";
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
    const r = esquemaAlta.safeParse({ clave: "x", usuario: "admin", contrasena: "Valida12345", confirmacion: "Otra12345678" });
    expect(r.success).toBe(false);
  });

  it("normaliza el usuario y limita los roles", () => {
    const ok = esquemaCrearCuenta.parse({ usuario: " Ana.Lopez ", nombre: "Ana", rol: "consultor", contrasena: "", paquetes: ["expedientes_propios"] });
    expect(ok.usuario).toBe("ana.lopez");
    expect(ok.contrasena).toBeNull();
    expect(esquemaCrearCuenta.safeParse({ usuario: "ana", nombre: "A", rol: "superadmin" }).success).toBe(false);
    expect(esquemaCrearCuenta.safeParse({ usuario: "ana", nombre: "A", rol: "cliente", paquetes: ["todo"] }).success).toBe(false);
    expect(esquemaCrearCuenta.safeParse({ usuario: "ana", nombre: "A", rol: "cliente", contrasena: "corta" }).success).toBe(false);
  });

  it.each(["ab", "1ana", "ana lopez", "josé", "ana@demo.mx", "a".repeat(33)])("rechaza el usuario «%s»", (u) => {
    expect(esquemaAlta.safeParse({ clave: "x", usuario: u, contrasena: "Valida12345", confirmacion: "Valida12345" }).success).toBe(false);
  });

  it("al entrar acepta mayúsculas y espacios en el usuario", () => {
    expect(esquemaEntrar.parse({ usuario: "  ADMIN ", contrasena: "x" }).usuario).toBe("admin");
  });
});

describe("cuentas por usuario", () => {
  it("deriva un correo interno no entregable", () => {
    expect(normalizarUsuario(" Ana ")).toBe("ana");
    expect(correoInterno("Ana")).toBe("ana@usuarios.circulo-nueve.invalid");
    expect(esCorreoInterno(correoInterno("ana"))).toBe(true);
    expect(esCorreoInterno("ana@gmail.com")).toBe(false);
  });

  it("genera contraseñas iniciales válidas y distintas", () => {
    const vistas = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const c = generarContrasenaInicial();
      expect(c).toMatch(/^([a-z]{3}\d-){3}[a-z]{3}\d$/);
      expect(esquemaNuevaContrasena.safeParse({ contrasena: c, confirmacion: c }).success).toBe(true);
      vistas.add(c);
    }
    expect(vistas.size).toBe(50);
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
