import type { Metadata } from "next";
import { exigirSesion } from "@/modulos/auth/sesion";
import { proveedoresParaBiblioteca } from "@/modulos/biblioteca/llm";
import { Seccion } from "@/ui/componentes/Seccion";
import { BotBiblioteca } from "@/ui/biblioteca/BotBiblioteca";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preguntar a la biblioteca · Círculo Nueve" };

export default async function PaginaPreguntar() {
  await exigirSesion("/biblioteca/preguntar");
  const proveedores = await proveedoresParaBiblioteca().catch(() => []);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Preguntar a la biblioteca</h1>
      <Seccion titulo="Bot de la biblioteca" ayuda="biblioteca-bot">
        <BotBiblioteca proveedores={proveedores} />
      </Seccion>
    </div>
  );
}
