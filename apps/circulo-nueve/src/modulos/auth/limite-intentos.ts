/**
 * Límite de intentos en memoria por ventana deslizante. Es una primera barrera
 * por instancia del servidor; Supabase Auth aplica además sus propios límites.
 */
export interface LimiteIntentos {
  registrar(clave: string): { permitido: boolean; reintentarEnMs: number };
  reiniciar(clave: string): void;
}

export function crearLimiteIntentos(maximo: number, ventanaMs: number, ahora: () => number = Date.now): LimiteIntentos {
  const intentos = new Map<string, number[]>();
  return {
    registrar(clave) {
      const t = ahora();
      const vigentes = (intentos.get(clave) ?? []).filter((x) => t - x < ventanaMs);
      if (vigentes.length >= maximo) {
        intentos.set(clave, vigentes);
        return { permitido: false, reintentarEnMs: ventanaMs - (t - vigentes[0]) };
      }
      vigentes.push(t);
      intentos.set(clave, vigentes);
      return { permitido: true, reintentarEnMs: 0 };
    },
    reiniciar(clave) {
      intentos.delete(clave);
    },
  };
}

const QUINCE_MINUTOS = 15 * 60 * 1000;

export const LIMITES = {
  alta: crearLimiteIntentos(5, QUINCE_MINUTOS),
  entrar: crearLimiteIntentos(10, QUINCE_MINUTOS),
  recuperar: crearLimiteIntentos(5, 60 * 60 * 1000),
  mfa: crearLimiteIntentos(10, QUINCE_MINUTOS),
};

export function mensajeLimite(ms: number): string {
  const minutos = Math.max(1, Math.ceil(ms / 60000));
  return `Demasiados intentos. Vuelve a intentarlo en ${minutos} minuto${minutos === 1 ? "" : "s"}.`;
}
