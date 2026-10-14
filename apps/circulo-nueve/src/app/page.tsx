import { leerConfigSupabase } from "@/modulos/auth/config";
import { esAdmin, obtenerSesion } from "@/modulos/auth/sesion";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { AppDemo } from "@/ui/demo/AppDemo";

async function AccesoRapido() {
  if (!leerConfigSupabase().configurado) return null;
  const sesion = await obtenerSesion();
  if (!sesion) {
    return (
      <aside data-testid="acceso-rapido" className="mb-6 rounded-xl border border-marino-800/20 bg-white/90 p-4 shadow-sm">
        <p className="text-sm text-slate-800">
          <strong>¿Tienes cuenta?</strong> Entra para subir archivos y fotos, ver los expedientes y consultar la biblioteca. Lo de abajo es solo una demostración.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <EnlaceBoton
            href={`/entrar?next=${encodeURIComponent("/biblioteca#centro-de-carga")}`}
            variante="principal"
            descripcion="Entra con tu usuario y contraseña; después se abre el Centro de carga para subir libros, documentos o fotos."
          >
            Entrar para subir archivos
          </EnlaceBoton>
        </div>
      </aside>
    );
  }
  const veFuentes = sesion.acceso.permisos.includes("admin_fuentes") || (sesion.acceso.debeCambiar && esAdmin(sesion));
  if (!veFuentes) return null;
  return (
    <aside data-testid="acceso-rapido" className="mb-6 rounded-xl border border-marino-800/20 bg-white/90 p-4 shadow-sm">
      <p className="text-sm text-slate-800">
        {sesion.acceso.debeCambiar
          ? "Antes de subir, elige tu contraseña nueva: la que tienes es provisional. Al guardarla se abre el Centro de carga."
          : "Accesos rápidos de la administración."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <EnlaceBoton
          href="/biblioteca#centro-de-carga"
          variante="principal"
          descripcion="Centro de carga de la biblioteca: elegir archivos, tomar una foto o elegir de la galería."
        >
          Subir archivos o fotos
        </EnlaceBoton>
        <EnlaceBoton href="/expedientes" descripcion="Abre el expediente de una persona y pulsa «Subir documentos o fotos», debajo de su nombre.">
          Subir a un expediente
        </EnlaceBoton>
      </div>
    </aside>
  );
}

export default function Inicio() {
  return (
    <>
      <AccesoRapido />
      <AppDemo />
    </>
  );
}
