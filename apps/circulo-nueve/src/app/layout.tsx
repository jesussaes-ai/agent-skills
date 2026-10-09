import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Emblema, Logotipo } from "@/ui/componentes/Marca";
import { SesionCabecera } from "@/ui/auth/SesionCabecera";
import { FondoDecorativo } from "@/ui/componentes/FondoDecorativo";
import "./globals.css";

export const metadata: Metadata = {
  title: "Círculo Nueve",
  description: "Explora numerología, carta natal y cábala como sistemas simbólicos de reflexión personal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f1b33",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="relative isolate min-h-screen">
        <FondoDecorativo />
        <header className="border-b-2 border-oro-400 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-2">
            <EnlaceBoton href="/" descripcion="Ir al inicio de Círculo Nueve." className="px-0 py-0">
              <Logotipo />
            </EnlaceBoton>
            <nav aria-label="Principal" className="flex flex-wrap items-center gap-2">
              <EnlaceBoton
                href="/"
                className="inline-flex items-center gap-1.5"
                descripcion="Vuelve al recorrido de demostración: presentación, consentimiento, perfil y resultados."
              >
                <Emblema />
                Inicio
              </EnlaceBoton>
              <EnlaceBoton
                href="/ayuda"
                className="inline-flex items-center gap-1.5"
                descripcion="Abre el Centro de ayuda con todas las secciones y el asistente."
              >
                <Emblema />
                Ayuda
              </EnlaceBoton>
              <SesionCabecera />
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6 sm:py-10">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-slate-600">
          En construcción · la demostración usa datos ficticios · uso personal no comercial.
        </footer>
      </body>
    </html>
  );
}
