import { describe, expect, it } from "vitest";
import { nuevoNonce, politicaCsp } from "./csp";

describe("Content-Security-Policy", () => {
  it("cada petición recibe un nonce distinto", () => {
    expect(nuevoNonce()).not.toBe(nuevoNonce());
    expect(nuevoNonce()).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });

  it("los scripts solo corren con el nonce y no hay eval en producción", () => {
    const csp = politicaCsp("abc", { supabaseUrl: "https://ref.supabase.co/" });
    expect(csp).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic';");
    expect(csp).not.toContain("unsafe-eval");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("connect-src 'self' https://ref.supabase.co;");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("en desarrollo permite eval y no fuerza https", () => {
    const csp = politicaCsp("abc", { desarrollo: true });
    expect(csp).toContain("'unsafe-eval'");
    expect(csp).not.toContain("upgrade-insecure-requests");
    expect(csp).toContain("connect-src 'self';");
  });
});
