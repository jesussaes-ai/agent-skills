"use server";

import { revalidatePath } from "next/cache";
import { datosDe, erroresDe, type EstadoFormulario } from "@/modulos/auth/esquemas";
import { esAdmin, obtenerSesion } from "@/modulos/auth/sesion";
import { configDesdeFormulario, esquemaProveedor } from "./esquemas";
import { borrarProveedor, dependenciasServidor, guardarProveedor, listarProveedoresAdmin } from "./repositorio";
import { probarProveedor } from "./servicio";

const RUTA = "/admin/proveedores";
const SIN_PERMISO: EstadoFormulario = { mensaje: "Solo la administración con verificación en dos pasos puede cambiar proveedores." };

async function esAdminVerificado(): Promise<boolean> {
  const sesion = await obtenerSesion();
  return Boolean(sesion && sesion.acceso.activo && esAdmin(sesion) && sesion.acceso.permisos.includes("admin_proveedores"));
}

export async function accionGuardarProveedor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await esAdminVerificado())) return SIN_PERMISO;
  const leido = esquemaProveedor.safeParse(datosDe(form));
  if (!leido.success) return { mensaje: "Revisa los campos marcados.", errores: erroresDe(leido.error) };
  const resultado = await guardarProveedor(configDesdeFormulario(leido.data), form.get("nuevo") === "1");
  if (resultado.error) return { mensaje: resultado.error };
  revalidatePath(RUTA);
  return { ok: true, mensaje: `Proveedor «${leido.data.nombre}» guardado.` };
}

export async function accionBorrarProveedor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await esAdminVerificado())) return SIN_PERMISO;
  const id = String(form.get("id") ?? "");
  if (!(await borrarProveedor(id))) return { mensaje: "No se pudo borrar el proveedor." };
  revalidatePath(RUTA);
  return { ok: true, mensaje: "Proveedor borrado. Su historial de consumo también se borró." };
}

export async function accionProbarProveedor(_: EstadoFormulario, form: FormData): Promise<EstadoFormulario> {
  if (!(await esAdminVerificado())) return SIN_PERMISO;
  const id = String(form.get("id") ?? "");
  const proveedor = (await listarProveedoresAdmin()).find((p) => p.config.id === id);
  if (!proveedor) return { mensaje: "No encontré ese proveedor." };
  const r = await probarProveedor(proveedor.config, dependenciasServidor());
  revalidatePath(RUTA);
  return { ok: r.ok, mensaje: `${r.ok ? "Conexión correcta" : "Falló la prueba"} en ${r.latenciaMs} ms. ${r.mensaje}` };
}
