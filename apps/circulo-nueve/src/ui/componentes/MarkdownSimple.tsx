import type { ReactNode } from "react";

/** Negritas y código en línea; los enlaces se muestran como texto (la app no abre enlaces sin ventana explicativa). */
function enLinea(texto: string): ReactNode[] {
  const limpio = texto.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  return limpio.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((trozo, i) => {
    if (trozo.startsWith("**") && trozo.endsWith("**")) return <strong key={i}>{trozo.slice(2, -2)}</strong>;
    if (trozo.startsWith("`") && trozo.endsWith("`")) return <code key={i} className="rounded bg-slate-100 px-1 text-[0.9em] [overflow-wrap:anywhere]">{trozo.slice(1, -1)}</code>;
    return trozo;
  });
}

/** Muestra un Markdown sencillo (títulos, listas y párrafos), como la línea del tiempo. */
export function MarkdownSimple({ texto }: { texto: string }) {
  const bloques: ReactNode[] = [];
  let lista: string[] = [];
  const cerrarLista = () => {
    if (!lista.length) return;
    bloques.push(
      <ul key={bloques.length} className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
        {lista.map((l, i) => <li key={i}>{enLinea(l)}</li>)}
      </ul>,
    );
    lista = [];
  };
  for (const linea of texto.replace(/\r\n/g, "\n").split("\n")) {
    const viñeta = linea.match(/^\s*[-*] (.*)$/);
    if (viñeta) {
      lista.push(viñeta[1]);
      continue;
    }
    if (/^\s{2,}\S/.test(linea) && lista.length) {
      lista[lista.length - 1] += ` ${linea.trim()}`;
      continue;
    }
    cerrarLista();
    const titulo = linea.match(/^(#{1,4}) (.*)$/);
    if (titulo) {
      const nivel = titulo[1].length;
      const clase = nivel === 1 ? "mb-3 text-3xl font-bold text-slate-900" : nivel === 2 ? "mb-2 mt-6 text-xl font-semibold text-slate-900" : "mb-2 mt-4 font-semibold text-slate-900";
      const Etiqueta = (nivel === 1 ? "h1" : nivel === 2 ? "h2" : "h3") as "h1" | "h2" | "h3";
      bloques.push(<Etiqueta key={bloques.length} className={clase}>{enLinea(titulo[2])}</Etiqueta>);
    } else if (linea.trim()) {
      bloques.push(<p key={bloques.length} className="mb-3 text-slate-700">{enLinea(linea)}</p>);
    }
  }
  cerrarLista();
  return <>{bloques}</>;
}
