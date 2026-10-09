import { accionSalir } from "@/modulos/auth/acciones";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { esAdmin, esSoloCliente, obtenerSesion } from "@/modulos/auth/sesion";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { BotonEnviar } from "./Campos";

export async function SesionCabecera() {
  if (!leerConfigSupabase().configurado) return null;
  const sesion = await obtenerSesion();
  if (!sesion) {
    return (
      <EnlaceBoton href="/entrar" descripcion="Inicia sesión con la cuenta que te dio la administración.">
        Entrar
      </EnlaceBoton>
    );
  }
  return (
    <>
      <EnlaceBoton href="/cuenta" descripcion="Tu cuenta: datos, contraseña y verificación en dos pasos.">
        {sesion.acceso.nombre ?? "Mi cuenta"}
      </EnlaceBoton>
      <EnlaceBoton href="/expedientes" descripcion="Expedientes a los que tienes acceso: perfiles, consentimientos, lecturas y documentos.">
        Expedientes
      </EnlaceBoton>
      {!esSoloCliente(sesion) && (
        <EnlaceBoton href="/biblioteca/preguntar" descripcion="Pregunta a la biblioteca de fuentes y recibe respuestas con citas verificables.">
          Preguntar
        </EnlaceBoton>
      )}
      {sesion.acceso.permisos.includes("admin_fuentes") && (
        <EnlaceBoton href="/biblioteca" descripcion="Administra las fuentes: centro de carga, páginas web, revisión, versiones y retiro.">
          Biblioteca
        </EnlaceBoton>
      )}
      {esAdmin(sesion) && (
        <>
          <EnlaceBoton href="/admin/usuarios" descripcion="Crea cuentas con usuario y contraseña, decide qué puede hacer cada asistente y restablece o suspende accesos.">
            Usuarios
          </EnlaceBoton>
          <EnlaceBoton href="/admin/ajustes" descripcion="Retención de documentos, vigencia de los enlaces de descarga y aviso de privacidad.">
            Ajustes
          </EnlaceBoton>
          <EnlaceBoton href="/admin/proveedores" descripcion="Proveedores de IA: modelos, llaves (solo el nombre del secreto), límites, política de datos y consumo.">
            Proveedores IA
          </EnlaceBoton>
        </>
      )}
      <form action={accionSalir}>
        <BotonEnviar variante="sutil" descripcion="Cierra tu sesión en este navegador.">
          Salir
        </BotonEnviar>
      </form>
    </>
  );
}
