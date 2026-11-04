import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Metadata } from "next";
import { APP_VERSION } from "@/modulos/version/version";
import { MarkdownSimple } from "@/ui/componentes/MarkdownSimple";

export const metadata: Metadata = { title: "Línea del tiempo · Círculo Nueve" };
// Se genera al publicar: muestra exactamente el LINEA_DE_TIEMPO.md del proyecto.
export const dynamic = "force-static";

export default function LineaDelTiempo() {
  const texto = readFileSync(join(process.cwd(), "LINEA_DE_TIEMPO.md"), "utf8");
  return (
    <article className="tarjeta-cristal p-5 [overflow-wrap:anywhere] sm:p-8">
      <p className="mb-4 text-sm text-slate-600">
        Estás usando la <strong>v{APP_VERSION}</strong>. Esta es la línea del tiempo de versiones y cambios, idéntica al archivo LINEA_DE_TIEMPO.md.
      </p>
      <MarkdownSimple texto={texto} />
    </article>
  );
}
