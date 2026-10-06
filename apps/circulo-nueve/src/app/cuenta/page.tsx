import type { Metadata } from "next";
import { exigirSesion } from "@/modulos/auth/sesion";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi cuenta · Círculo Nueve" };

const NOMBRE_ROL: Record<string, string> = { admin: "Administración", consultor: "Consultor/a", cliente: "Cliente" };

export default async function PaginaCuenta({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sesion = await exigirSesion("/cuenta");
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {params.contrasena === "actualizada" && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          Contraseña actualizada.
        </p>
      )}
      <Seccion titulo="Mi cuenta" ayuda="cuenta">
        {sesion.acceso.estado !== "activo" && (
          <p role="alert" className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
            Tu cuenta está {sesion.acceso.estado ?? "sin perfil"}: no tiene acceso a expedientes ni a la administración.
          </p>
        )}
        <dl className="grid gap-2 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          <dt className="font-medium">Nombre</dt>
          <dd>{sesion.acceso.nombre ?? "—"}</dd>
          <dt className="font-medium">Correo</dt>
          <dd>{sesion.correo}</dd>
          <dt className="font-medium">Estado</dt>
          <dd data-testid="mi-estado">{sesion.acceso.estado ?? "sin perfil"}</dd>
          <dt className="font-medium">Roles</dt>
          <dd data-testid="mis-roles">{sesion.acceso.roles.map((r) => NOMBRE_ROL[r] ?? r).join(", ") || "ninguno"}</dd>
          <dt className="font-medium">Verificación en dos pasos</dt>
          <dd>
            {sesion.tieneFactorVerificado ? <Etiqueta>Activada</Etiqueta> : <Etiqueta tono="gris">No configurada</Etiqueta>}
          </dd>
        </dl>
        <div className="mt-5 flex flex-wrap gap-3">
          <EnlaceBoton href="/cuenta/contrasena" descripcion="Elige una contraseña nueva para tu cuenta.">
            Cambiar contraseña
          </EnlaceBoton>
          {!sesion.tieneFactorVerificado && (
            <EnlaceBoton href="/cuenta/verificacion" descripcion="Añade un código de tu aplicación de autenticación al iniciar sesión.">
              Configurar verificación en dos pasos
            </EnlaceBoton>
          )}
        </div>
      </Seccion>
    </div>
  );
}
