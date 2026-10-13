import type { Metadata } from "next";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Seccion } from "@/ui/componentes/Seccion";

export const metadata: Metadata = { title: "Recuperar contraseña · Círculo Nueve" };

export default function PaginaRecuperar() {
  return (
    <div className="mx-auto max-w-md">
      <Seccion titulo="Recuperar la contraseña" ayuda="acceso">
        <div className="space-y-4 text-sm text-slate-700">
          <p>
            Las cuentas no usan correo. Si olvidaste tu contraseña, pide a la administración que la restablezca: te
            dará una provisional (o un enlace de un solo uso) y, al entrar, elegirás una nueva.
          </p>
          <p>Si eres la administración y perdiste tu acceso, sigue el procedimiento de recuperación de emergencia del manual.</p>
          <EnlaceBoton href="/entrar" className="px-0" descripcion="Vuelve a la página para entrar.">
            Volver a entrar
          </EnlaceBoton>
        </div>
      </Seccion>
    </div>
  );
}
