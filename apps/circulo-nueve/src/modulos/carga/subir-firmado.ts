import { mimeDe } from "./reglas";

export interface DestinoFirmado {
  supabaseUrl: string;
  clavePublica: string;
  bucket: string;
  ruta: string;
  token: string;
}

/**
 * Sube un archivo a una URL firmada de Supabase Storage informando del avance.
 * Mismo formato que `uploadToSignedUrl` de supabase-js, pero con XMLHttpRequest
 * porque `fetch` no expone el progreso de subida.
 */
export function subirConProgreso(destino: DestinoFirmado, archivo: File, alAvanzar: (fraccion: number) => void): Promise<{ ok: boolean; mensaje?: string }> {
  const url = new URL(`${destino.supabaseUrl.replace(/\/$/, "")}/storage/v1/object/upload/sign/${destino.bucket}/${destino.ruta}`);
  url.searchParams.set("token", destino.token);
  const cuerpo = new FormData();
  cuerpo.append("cacheControl", "3600");
  // El tipo se deduce de la extensión: algunos navegadores móviles mandan el archivo sin tipo.
  cuerpo.append("", new Blob([archivo], { type: mimeDe(archivo.name) }), archivo.name);

  return new Promise((resolver) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url.toString());
    xhr.setRequestHeader("apikey", destino.clavePublica);
    xhr.setRequestHeader("authorization", `Bearer ${destino.clavePublica}`);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) alAvanzar(Math.min(1, e.loaded / e.total));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        alAvanzar(1);
        return resolver({ ok: true });
      }
      let mensaje = `El almacenamiento respondió ${xhr.status}.`;
      try {
        const cuerpoError = JSON.parse(xhr.responseText) as { message?: string; error?: string };
        mensaje = cuerpoError.message ?? cuerpoError.error ?? mensaje;
      } catch {}
      resolver({ ok: false, mensaje });
    };
    xhr.onerror = () => resolver({ ok: false, mensaje: "Se perdió la conexión durante la subida. Revisa la señal y vuelve a intentarlo." });
    xhr.ontimeout = xhr.onerror;
    xhr.send(cuerpo);
  });
}
