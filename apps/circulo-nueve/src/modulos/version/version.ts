import paquete from "../../../package.json";

/** Número de versión que se ve arriba en todas las pantallas (fuente única: package.json). */
export const APP_VERSION: string = paquete.version;

/** Compara «1.10.0» con «1.9.3» por números: positivo si a es más nueva. */
export function compararVersiones(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.replace(/^v/, "").split(".").map((x) => Number.parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

/** Identificador del despliegue que sirve esta página; cambia en cada publicación. */
export function versionActual(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_DEPLOYMENT_ID?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || "local";
}

/**
 * Qué hacer cuando el servidor publica otro despliegue: nunca se recarga sola,
 * se propone «⬆️ Actualizar a la vX» para no perder nada de lo que se esté escribiendo.
 */
export function hayActualizacion(p: { local: string; remota: string | null | undefined }): boolean {
  return Boolean(p.remota) && p.remota !== p.local;
}
