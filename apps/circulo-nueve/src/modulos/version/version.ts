/** Identificador del despliegue que sirve esta página; cambia en cada publicación. */
export function versionActual(env: Record<string, string | undefined> = process.env): string {
  return env.VERCEL_DEPLOYMENT_ID?.trim() || env.VERCEL_GIT_COMMIT_SHA?.trim() || "local";
}

export type Actualizacion = "nada" | "recargar" | "avisar";

/**
 * Qué hacer cuando el servidor ya publica otra versión.
 * `recargadaPara` es la versión remota que motivó la última recarga automática:
 * si tras recargar sigue sin coincidir, se avisa en lugar de recargar en bucle.
 */
export function decidirActualizacion(p: { local: string; remota: string | null | undefined; editando: boolean; recargadaPara: string | null }): Actualizacion {
  if (!p.remota || p.remota === p.local) return "nada";
  if (p.editando || p.recargadaPara === p.remota) return "avisar";
  return "recargar";
}
