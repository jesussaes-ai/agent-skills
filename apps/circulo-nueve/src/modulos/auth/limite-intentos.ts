/**
 * Límite de intentos en memoria por ventana deslizante. Es el respaldo por
 * instancia cuando la tabla compartida de límites (Supabase) no está disponible;
 * Supabase Auth aplica además sus propios límites.
 */
export interface LimiteIntentos {
  registrar(clave: string): { permitido: boolean; reintentarEnMs: number };
  /** Como `registrar`, pero sin contar un intento. */
  consultar(clave: string): { permitido: boolean; reintentarEnMs: number };
  reiniciar(clave: string): void;
}

export function crearLimiteIntentos(maximo: number, ventanaMs: number, ahora: () => number = Date.now): LimiteIntentos {
  const intentos = new Map<string, number[]>();
  const revisar = (clave: string, contar: boolean) => {
    const t = ahora();
    const vigentes = (intentos.get(clave) ?? []).filter((x) => t - x < ventanaMs);
    if (vigentes.length >= maximo) {
      intentos.set(clave, vigentes);
      return { permitido: false, reintentarEnMs: ventanaMs - (t - vigentes[0]) };
    }
    if (contar) vigentes.push(t);
    intentos.set(clave, vigentes);
    return { permitido: true, reintentarEnMs: 0 };
  };
  return {
    registrar: (clave) => revisar(clave, true),
    consultar: (clave) => revisar(clave, false),
    reiniciar(clave) {
      intentos.delete(clave);
    },
  };
}
