import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Emblema, Logotipo } from "@/ui/componentes/Marca";
import { SesionCabecera } from "@/ui/auth/SesionCabecera";
import { FondoDecorativo } from "@/ui/componentes/FondoDecorativo";
import { SaltoContenido } from "@/ui/componentes/SaltoContenido";
import { VersionApp } from "@/ui/componentes/VersionApp";
import { BotonTema } from "@/ui/componentes/BotonTema";
import { APP_VERSION, versionActual } from "@/modulos/version/version";
import "./globals.css";

export const metadata: Metadata = {
  title: "Círculo Nueve",
  description: "Explora numerología, carta natal y cábala como sistemas simbólicos de reflexión personal.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f1b33" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1222" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="relative isolate min-h-screen">
        <FondoDecorativo />
        <SaltoContenido />
        <header className="border-b-2 border-oro-400 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <EnlaceBoton href="/" descripcion="Ir al inicio de Círculo Nueve." className="px-0 py-0">
                <Logotipo />
              </EnlaceBoton>
              <VersionApp despliegue={versionActual()} numero={APP_VERSION} />
            </div>
            <nav aria-label="Principal" className="flex flex-wrap items-center gap-2">
              <EnlaceBoton
                href="/consulta"
                variante="principal"
                className="!px-3 !py-1.5 text-sm"
                descripcion="Empieza una consulta nueva: pega o dicta la plática, confirma los datos y descarga una sola carta PDF con todo."
              >
                ✨ Nueva consulta
              </EnlaceBoton>
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
                descripcion="🆘 Ayúdame: abre el Centro de ayuda con el uso paso a paso, la guía de todos los botones y el asistente."
              >
                🆘 Ayúdame
              </EnlaceBoton>
              <BotonTema />
              <SesionCabecera />
            </nav>
          </div>
        </header>
        <main id="contenido" tabIndex={-1} className="mx-auto max-w-4xl px-4 py-6 focus:outline-none sm:py-10">
          {children}
        </main>
        <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-slate-600">
          En construcción · la demostración usa datos ficticios · uso personal no comercial.
        </footer>
      </body>
    </html>
  );
}
