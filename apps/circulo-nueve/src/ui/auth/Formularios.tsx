"use client";

import { useActionState } from "react";
import {
  accionAltaInicial,
  accionCambiarContrasena,
  accionDesactivarMfa,
  accionEntrar,
  accionVerificarMfa,
} from "@/modulos/auth/acciones";
import { BotonEnviar, Campo, CampoContrasena, ESTADO_INICIAL, MensajeFormulario } from "./Campos";

const NOTA_CONTRASENA = "Al menos 10 caracteres, con letras y números.";
const NOTA_USUARIO = "De 3 a 32 caracteres: empieza con letra; letras sin acento, números, punto, guion o guion bajo.";

export function FormularioAlta() {
  const [estado, accion] = useActionState(accionAltaInicial, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      <CampoContrasena
        etiqueta="Clave de alta"
        name="clave"
        autoComplete="off"
        required
        error={estado.errores?.clave}
        nota="Solo la conoce la persona responsable del proyecto. Se valida en el servidor y deja de servir tras el alta."
      />
      <Campo
        etiqueta="Usuario de administración"
        name="usuario"
        required
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={estado.valores?.usuario}
        nota={NOTA_USUARIO}
        error={estado.errores?.usuario}
      />
      <CampoContrasena etiqueta="Contraseña" name="contrasena" required autoComplete="new-password" nota={NOTA_CONTRASENA} error={estado.errores?.contrasena} />
      <CampoContrasena etiqueta="Repite la contraseña" name="confirmacion" required autoComplete="new-password" error={estado.errores?.confirmacion} />
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
      <Campo
        etiqueta="Usuario"
        name="usuario"
        required
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        defaultValue={estado.valores?.usuario}
        error={estado.errores?.usuario}
      />
      <CampoContrasena etiqueta="Contraseña" name="contrasena" required autoComplete="current-password" error={estado.errores?.contrasena} />
      <BotonEnviar descripcion="Comprueba tu usuario y contraseña. Si activaste la verificación en dos pasos, después te pedirá el código.">
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

export function FormularioContrasena({ siguiente }: { siguiente?: string }) {
  const [estado, accion] = useActionState(accionCambiarContrasena, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      <MensajeFormulario estado={estado} />
      {siguiente && <input type="hidden" name="next" value={siguiente} />}
      <CampoContrasena etiqueta="Contraseña nueva" name="contrasena" required autoComplete="new-password" nota={NOTA_CONTRASENA} error={estado.errores?.contrasena} />
      <CampoContrasena etiqueta="Repite la contraseña" name="confirmacion" required autoComplete="new-password" error={estado.errores?.confirmacion} />
      <BotonEnviar descripcion="Guarda la contraseña nueva de tu cuenta.">Guardar contraseña</BotonEnviar>
    </form>
  );
}

export function FormularioDesactivarMfa() {
  const [estado, accion] = useActionState(accionDesactivarMfa, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-2">
      <BotonEnviar variante="secundario" descripcion="Quita la verificación en dos pasos de tu cuenta. A partir de entonces bastará la contraseña para entrar; no se recomienda.">
        Desactivar verificación en dos pasos
      </BotonEnviar>
      <MensajeFormulario estado={estado} />
    </form>
  );
}
