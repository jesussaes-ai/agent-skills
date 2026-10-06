"use client";

import { useActionState } from "react";
import {
  accionAltaInicial,
  accionCambiarContrasena,
  accionEntrar,
  accionRecuperar,
  accionVerificarMfa,
} from "@/modulos/auth/acciones";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "./Campos";

const NOTA_CONTRASENA = "Al menos 10 caracteres, con letras y números.";

export function FormularioAlta() {
  const [estado, accion] = useActionState(accionAltaInicial, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo
        etiqueta="Clave de alta"
        name="clave"
        type="password"
        autoComplete="off"
        required
        error={estado.errores?.clave}
        nota="Solo la conoce el responsable. Se valida en el servidor y deja de servir tras el alta."
      />
      <Campo etiqueta="Nombre para mostrar" name="nombre" required autoComplete="name" error={estado.errores?.nombre} />
      <Campo etiqueta="Correo de administración" name="correo" type="email" required autoComplete="email" error={estado.errores?.correo} />
      <Campo etiqueta="Contraseña" name="contrasena" type="password" required autoComplete="new-password" nota={NOTA_CONTRASENA} error={estado.errores?.contrasena} />
      <Campo etiqueta="Repite la contraseña" name="confirmacion" type="password" required autoComplete="new-password" error={estado.errores?.confirmacion} />
      <BotonEnviar descripcion="Valida la clave en el servidor, crea la cuenta de administración y cierra esta página para siempre.">
        Crear administración
      </BotonEnviar>
    </form>
  );
}

export function FormularioEntrar({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState(accionEntrar, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <input type="hidden" name="next" value={siguiente} />
      <Campo etiqueta="Correo" name="correo" type="email" required autoComplete="email" error={estado.errores?.correo} />
      <Campo etiqueta="Contraseña" name="contrasena" type="password" required autoComplete="current-password" error={estado.errores?.contrasena} />
      <BotonEnviar descripcion="Comprueba tu correo y contraseña. Si tienes verificación en dos pasos, después te pedirá el código.">
        Entrar
      </BotonEnviar>
    </form>
  );
}

export function FormularioVerificar({ siguiente }: { siguiente: string }) {
  const [estado, accion] = useActionState(accionVerificarMfa, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <input type="hidden" name="next" value={siguiente} />
      <Campo
        etiqueta="Código de 6 dígitos"
        name="codigo"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d{6}"
        maxLength={6}
        required
        error={estado.errores?.codigo}
        nota="Ábrelo en tu aplicación de autenticación (Google Authenticator, Aegis, 1Password…)."
      />
      <BotonEnviar descripcion="Comprueba el código de tu aplicación de autenticación y completa el inicio de sesión.">
        Verificar
      </BotonEnviar>
    </form>
  );
}

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(accionRecuperar, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo etiqueta="Correo de tu cuenta" name="correo" type="email" required autoComplete="email" error={estado.errores?.correo} />
      <BotonEnviar descripcion="Envía un enlace de un solo uso para elegir una contraseña nueva. Por seguridad, el mensaje es el mismo exista o no la cuenta.">
        Enviar enlace
      </BotonEnviar>
    </form>
  );
}

export function FormularioContrasena() {
  const [estado, accion] = useActionState(accionCambiarContrasena, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <Campo etiqueta="Contraseña nueva" name="contrasena" type="password" required autoComplete="new-password" nota={NOTA_CONTRASENA} error={estado.errores?.contrasena} />
      <Campo etiqueta="Repite la contraseña" name="confirmacion" type="password" required autoComplete="new-password" error={estado.errores?.confirmacion} />
      <BotonEnviar descripcion="Guarda la contraseña nueva de tu cuenta.">Guardar contraseña</BotonEnviar>
    </form>
  );
}
