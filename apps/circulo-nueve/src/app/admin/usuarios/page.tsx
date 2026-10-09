import type { Metadata } from "next";
import { NOMBRES_PAQUETES, PAQUETES_PERMISOS } from "@/modulos/auth/esquemas";
import { exigirAdmin } from "@/modulos/auth/sesion";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { FormularioCrearCuenta, NOMBRE_ROL, TablaUsuarios, type FilaUsuario } from "@/ui/auth/AdminUsuarios";
import { Seccion } from "@/ui/componentes/Seccion";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Usuarios · Círculo Nueve" };

const ROLES = ["admin", "consultor", "cliente"] as const;

export default async function PaginaUsuarios() {
  const sesion = await exigirAdmin("/admin/usuarios");
  const supabase = await clienteSupabaseServidor();

  const [{ data: perfiles }, { data: roles }, { data: permisosRol }, { data: permisosUsuario }, { data: catalogo }] = await Promise.all([
    supabase.from("user_profiles").select("user_id, display_name, username, status, debe_cambiar_contrasena").order("display_name"),
    supabase.from("user_roles").select("user_id, role_id"),
    supabase.from("role_permissions").select("role_id, permission_id, alcance"),
    supabase.from("user_permissions").select("user_id, permission_id, alcance"),
    supabase.from("permissions").select("id, descripcion").order("id"),
  ]);

  // Los factores de verificación viven en Auth; la autorización ya se comprobó con exigirAdmin.
  const servicio = clienteSupabaseAdmin();
  const factores = await Promise.all(
    (perfiles ?? []).map(async (p) => {
      const { data } = await servicio.auth.admin.mfa.listFactors({ userId: p.user_id });
      return (data?.factors ?? []).some((f) => f.status === "verified") ? p.user_id : null;
    }),
  );
  const conMfa = new Set(factores.filter(Boolean));

  const filas: FilaUsuario[] = (perfiles ?? []).map((p) => {
    const propios = (permisosUsuario ?? []).filter((x) => x.user_id === p.user_id);
    return {
      id: p.user_id,
      nombre: p.display_name,
      usuario: p.username ?? "—",
      estado: p.status,
      roles: (roles ?? []).filter((r) => r.user_id === p.user_id).map((r) => r.role_id),
      paquetes: NOMBRES_PAQUETES.filter((paquete) =>
        PAQUETES_PERMISOS[paquete].permisos.every(([permiso, alcance]) => propios.some((x) => x.permission_id === permiso && x.alcance === alcance)),
      ),
      mfaActivo: conMfa.has(p.user_id),
      debeCambiar: Boolean(p.debe_cambiar_contrasena),
      esPropia: p.user_id === sesion.usuarioId,
    };
  });

  const alcance = (rol: string, permiso: string) =>
    (permisosRol ?? []).find((x) => x.role_id === rol && x.permission_id === permiso)?.alcance;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Administración de usuarios</h1>
      <Seccion titulo="Crear una cuenta" ayuda="administracion-usuarios">
        <FormularioCrearCuenta />
      </Seccion>
      <Seccion titulo="Cuentas" ayuda="administracion-usuarios">
        <TablaUsuarios filas={filas} />
      </Seccion>
      <Seccion titulo="Permisos fijos por tipo de cuenta" ayuda="administracion-usuarios">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="mb-2 text-left text-slate-600">
              «Global»: en todos los expedientes. «Propio»: solo en los creados por la persona o asignados. Las
              cuentas de asistente no tienen nada fijo: reciben solo lo que marques. Las cuentas de cliente ven, en lectura,
              únicamente el expediente vinculado a su cuenta.
            </caption>
            <thead>
              <tr className="border-b border-slate-200">
                <th scope="col" className="py-2 pr-4">Permiso</th>
                {ROLES.map((r) => (
                  <th key={r} scope="col" className="py-2 pr-4">{NOMBRE_ROL[r]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(catalogo ?? []).map((p) => (
                <tr key={p.id} className="border-b border-slate-100">
                  <th scope="row" className="py-2 pr-4 font-normal">{p.descripcion}</th>
                  {ROLES.map((r) => (
                    <td key={r} className="py-2 pr-4">{alcance(r, p.id) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>
    </div>
  );
}
