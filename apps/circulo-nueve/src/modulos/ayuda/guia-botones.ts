/** Guía de todos los botones: se arma con el nombre y la descripción de cada `Boton`/`EnlaceBoton` del código. */

export interface BotonGuia {
  nombre: string;
  descripcion: string;
}

export interface GrupoGuia {
  pantalla: string;
  botones: BotonGuia[];
}

const PANTALLAS: [RegExp, string][] = [
  [/^app\/biblioteca|^ui\/biblioteca/, "Biblioteca"],
  [/^app\/expedientes|^ui\/expedientes/, "Expedientes"],
  [/^app\/consulta|^ui\/consulta/, "Nueva consulta"],
  [/^ui\/carta-natal/, "Carta natal"],
  [/^ui\/demo|^app\/page/, "Inicio y demostración"],
  [/^app\/admin|^ui\/auth\/AdminUsuarios|^ui\/proveedores/, "Administración"],
  [/^app\/(entrar|recuperar|setup|cuenta)|^ui\/auth/, "Cuenta y acceso"],
  [/^app\/ayuda|^ui\/asistente|^ui\/voz/, "Ayuda y asistente"],
  [/^app\/compartido/, "Enlaces compartidos"],
  [/^ui\/carga/, "Subir archivos"],
];

export function pantallaDe(ruta: string): string {
  return PANTALLAS.find(([re]) => re.test(ruta))?.[1] ?? "En todas las pantallas";
}

/** Quita las expresiones `{…}` (con llaves anidadas) para que no estorben al buscar el texto del botón. */
function sinExpresiones(s: string): string {
  let anterior = "";
  while (anterior !== s) {
    anterior = s;
    s = s.replace(/\{[^{}]*\}/g, " ");
  }
  return s;
}

/** Texto visible del botón: lo que queda entre el final de la etiqueta de apertura y la de cierre. */
function nombreDelBoton(codigo: string, desde: number, etiqueta: string): string {
  const cierre = codigo.indexOf(`</${etiqueta}>`, desde);
  if (cierre === -1) return "";
  const trozo = sinExpresiones(codigo.slice(desde, cierre));
  const apertura = trozo.indexOf(">");
  if (apertura === -1) return "";
  return trozo
    .slice(apertura + 1)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recibe archivos {ruta relativa a src, código} y devuelve los botones agrupados por pantalla, sin repetir. */
export function armarGuia(archivos: { ruta: string; codigo: string }[]): GrupoGuia[] {
  const grupos = new Map<string, Map<string, BotonGuia>>();
  for (const a of [...archivos].sort((x, y) => x.ruta.localeCompare(y.ruta))) {
    for (const m of a.codigo.matchAll(/<(Boton|EnlaceBoton)\b/g)) {
      // Solo hasta el cierre de este botón o el siguiente botón: así nunca se toma la descripción de otro.
      const resto = a.codigo.slice(m.index);
      const fin = [resto.indexOf(`</${m[1]}>`), resto.slice(1).search(/<(Boton|EnlaceBoton)\b/) + 1].filter((n) => n > 0);
      const propio = resto.slice(0, fin.length ? Math.min(...fin) : 1500);
      const d = /descripcion=(?:"([^"]{8,})"|\{`([^`]{8,})`\})/.exec(propio);
      if (!d) continue;
      const descripcion = (d[1] ?? d[2]).replace(/\$\{[^}]*\}/g, "…").replace(/\s+/g, " ").trim();
      const etiquetaAria = /aria-label="([^"]+)"/.exec(propio)?.[1];
      const nombre = nombreDelBoton(a.codigo, m.index, m[1]) || etiquetaAria || "(nombre variable)";
      const pantalla = pantallaDe(a.ruta);
      if (!grupos.has(pantalla)) grupos.set(pantalla, new Map());
      grupos.get(pantalla)!.set(`${nombre}|${descripcion}`, { nombre, descripcion });
    }
  }
  return [...grupos]
    .map(([pantalla, botones]) => ({ pantalla, botones: [...botones.values()] }))
    .sort((a, b) => a.pantalla.localeCompare(b.pantalla, "es"));
}
