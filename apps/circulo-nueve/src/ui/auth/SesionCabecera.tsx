import { accionSalir } from "@/modulos/auth/acciones";
import { leerConfigSupabase } from "@/modulos/auth/config";
import { esAdmin, esSoloCliente, obtenerSesion } from "@/modulos/auth/sesion";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { BotonEnviar } from "./Campos";

const DESTINO_SUBIR = "/biblioteca#centro-de-carga";

export async function SesionCabecera() {
  if (!leerConfigSupabase().configurado) return null;
  const sesion = await obtenerSesion();
  if (!sesion) {
    return (
      <>
        <EnlaceBoton
          href={`/entrar?next=${encodeURIComponent(DESTINO_SUBIR)}`}
          descripcion="Para subir libros, documentos o fotos primero entra con tu cuenta; después se abre el Centro de carga."
        >
          Subir archivos
        </EnlaceBoton>
        <EnlaceBoton href="/entrar" variante="principal" descripcion="Inicia sesión con la cuenta que te dio la administración. Sin entrar solo se ve la demostración.">
          Entrar
        </EnlaceBoton>
      </>
    );
  }
  // Con la contraseña provisional la base aún no entrega permisos; el rol admin ya indica qué verá al elegirla.
  const debeCambiar = sesion.acceso.debeCambiar;
  const veFuentes = sesion.acceso.permisos.includes("admin_fuentes") || (debeCambiar && esAdmin(sesion));
  return (
    <>
      {debeCambiar && (
        <EnlaceBoton
          href={`/cuenta/contrasena?obligatorio=1&next=${encodeURIComponent(DESTINO_SUBIR)}`}
          variante="principal"
          descripcion="Tu contraseña es provisional. Elige una nueva para usar la app; después se abre el Centro de carga."
        >
          Elegir contraseña
        </EnlaceBoton>
      )}
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
      {veFuentes && (
        <>
          <EnlaceBoton href="/biblioteca" descripcion="Administra las fuentes: centro de carga, páginas web, revisión, versiones y retiro.">
            Biblioteca
          </EnlaceBoton>
          <EnlaceBoton
            href="/biblioteca#centro-de-carga"
            descripcion="Sube libros, documentos o fotos a la biblioteca desde el teléfono, la tableta o la computadora. Para el expediente de una persona, usa el botón dentro de su expediente."
          >
            Subir archivos
          </EnlaceBoton>
        </>
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
