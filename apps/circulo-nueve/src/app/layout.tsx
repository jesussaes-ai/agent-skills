import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circulo Nueve",
  description: "Explora numerología, carta natal y cábala como sistemas simbólicos de reflexión personal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen">
        <header className="border-b border-violet-100 bg-white">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-lg font-bold text-violet-900">Circulo Nueve</p>
            <nav aria-label="Principal" className="flex gap-2">
              <EnlaceBoton href="/" descripcion="Vuelve al recorrido de demostración: bienvenida, consentimiento, perfil y resultados.">
                Inicio
              </EnlaceBoton>
              <EnlaceBoton href="/ayuda" descripcion="Abre el Centro de ayuda con todas las secciones y el asistente.">
                Ayuda
              </EnlaceBoton>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-slate-500">
          Etapa 1 · demostración con datos ficticios · uso personal no comercial.
        </footer>
      </body>
    </html>
  );
}
