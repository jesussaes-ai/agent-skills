# Recuperación de emergencia de la administración

Úsala solo si nadie puede entrar como administración: se perdió la contraseña y el correo, el dispositivo con la verificación en dos pasos, o la cuenta quedó suspendida o revocada. Si no, basta con «¿Olvidaste tu contraseña?».

## Quién y dónde

- La ejecuta el **responsable del proyecto**, en su propia máquina o en un entorno de servidor de confianza, nunca en el navegador.
- Necesita la **llave de servicio** de Supabase (`SUPABASE_SERVICE_ROLE_KEY`). Sácala del panel de Supabase en ese momento y no la pegues en chats ni documentos.
- Deja constancia en la auditoría (`audit_log`, acción `recuperacion_emergencia_admin`) junto con el motivo escrito.

## Pasos

```bash
cd apps/circulo-nueve            # o la raíz del repo propio
export NEXT_PUBLIC_SUPABASE_URL="https://<proyecto>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<llave de servicio>"      # solo en esta terminal
export NEXT_PUBLIC_SITE_URL="https://<dominio de la app>"

npm run admin:emergencia -- --correo admin@dominio --motivo "Pérdida del dispositivo de verificación" --quitar-mfa
# Si la cuenta ya no existe:      añade --crear (envía una invitación)

unset SUPABASE_SERVICE_ROLE_KEY
```

El script:

1. Busca la cuenta por correo; con `--crear`, si no existe, la invita.
2. La desbloquea en Auth.
3. Con `--quitar-mfa`, elimina sus factores de verificación en dos pasos.
4. Llama a `recuperacion_emergencia_admin` (solo service role): deja la cuenta activa, le asigna `admin` y lo registra en la auditoría con el motivo.
5. Envía un correo para elegir contraseña nueva (salvo que acabe de invitarla).

Después, la persona entra, configura otra vez la verificación en dos pasos (obligatoria para administrar) y revisa en la auditoría y en `/admin/usuarios` que todo esté en orden.

## Por qué no se usa la clave de alta

`/setup` funciona una sola vez (`app_setup.completed_at`) y después responde 410. Volver a abrirlo convertiría la clave de alta en una puerta permanente. La recuperación exige la llave de servicio, que ya da control total sobre la base y que solo tiene el responsable.

## Pruebas

- pgTAP (`04_expedientes_documentos.test.sql`): la función exige un motivo y queda auditada; ningún usuario puede invocarla.
- e2e (`02-expedientes.spec.ts`): el script asigna `admin` a una cuenta y registra el motivo.
