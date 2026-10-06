# Cuentas y acceso

Estado: **funciona con Supabase local** y está probado de extremo a extremo. No hay proyecto Supabase remoto.

## Flujo

| Paso | Ruta | Qué ocurre |
|---|---|---|
| Alta inicial | `/setup` | La clave se compara solo en el servidor con el hash argon2id de `ADMIN_SETUP_KEY_HASH`. Si es correcta, se crea la cuenta y `completar_alta_admin` asigna el rol `admin` dentro de una transacción con bloqueo. Funciona una sola vez: después, el proxy responde **410**. |
| Verificación en dos pasos | `/cuenta/verificacion` | Inscripción TOTP (QR y clave secreta). Es obligatoria para administrar. |
| Entrar | `/entrar` → `/entrar/verificar` | Correo y contraseña; si la cuenta tiene TOTP, se pide el código (sesión `aal2`). |
| Invitar | `/admin/usuarios` | La administración invita por correo con un rol. El enlace es de un solo uso y lleva a `/auth/confirmar` → `/cuenta/contrasena`. |
| Invitar o recuperar sin correo | `/admin/usuarios` | «No enviar correo» al invitar, o «Enlace de recuperación» en una cuenta: el panel muestra un enlace `token_hash` de un solo uso (caduca en 1 h) para compartirlo por un canal privado. Queda en la auditoría. Sirve cuando no hay SMTP propio. |
| Recuperar | `/recuperar` | Enlace de un solo uso por correo. La respuesta es la misma exista o no la cuenta. |
| Suspender, revocar o reactivar | `/admin/usuarios` | Cambia `user_profiles.status` (RLS lo aplica de inmediato) y bloquea o desbloquea el inicio de sesión en Auth. |
| Roles | `/admin/usuarios` | Asignar o retirar `admin`, `consultor` o `cliente`. Nadie puede cambiar sus propios roles ni su estado. |

## Garantías y dónde se aplican

- **No hay registro público.** Se cierra con `[auth] enable_signup = false` y lo comprueba una prueba e2e. Ojo: en la CLI, `[auth.email] enable_signup` debe quedarse en `true`, porque si no se apaga también el inicio de sesión por correo.
- **La administración exige verificación en dos pasos en la base de datos.** `has_perm` y `has_global_perm` no conceden permisos del rol `admin` si el JWT no es `aal2` (migración `…0600`). La app, además, redirige a configurar o verificar la MFA.
- **La autorización vive en el servidor.** Las acciones de servidor validan con Zod. Las operaciones con la llave de servicio (crear la cuenta de administración, invitar, bloquear, listar correos) se ejecutan solo después de comprobar el rol, el permiso y el nivel `aal2` de quien llama. Los perfiles y roles se escriben con la sesión del usuario, así que RLS también los comprueba.
- **Límites de intentos** en memoria por instancia: alta 5/15 min, entrar 10/15 min, recuperar 5/h, MFA 10/15 min. Supabase Auth aplica además sus propios límites.
- **Redirecciones seguras:** `next` solo acepta rutas internas. Las URL absolutas se construyen con `NEXT_PUBLIC_SITE_URL` o con el `Host` de la petición.
- **Auditoría:** los cambios de estado y de rol quedan en `audit_log`, sin datos personales.
- **Contraseñas:** al menos 10 caracteres, con letras y números (en Zod y en `[auth] password_requirements`).

## Clave de alta: generar, rotar, un solo uso

```bash
npm run setup:hash               # escribe la clave (no se muestra); imprime el hash
npm run setup:hash -- --generar  # genera una clave aleatoria, la muestra una vez e imprime el hash
```

- Carga el hash como secreto `ADMIN_SETUP_KEY_HASH` (en `.env.local` en local; en el hosting, como variable secreta).
- **Rotar antes del alta:** genera otro hash y reemplaza el secreto; la clave anterior deja de servir.
- **Después del alta,** la clave ya no sirve aunque siga cargada: `app_setup.completed_at` está fijado y `/setup` responde 410.
- **Recuperación de emergencia** (si se pierde el acceso de administración): pendiente. Requiere un procedimiento con la llave de servicio que quede auditado.

## Ejecutar en local

```bash
npm run db:start                                    # Supabase local con Auth, Storage y Mailpit (correos de prueba)
npx supabase status -o env                          # copia API_URL, ANON_KEY y SERVICE_ROLE_KEY a .env.local
npm run setup:hash -- --generar                     # copia el hash a ADMIN_SETUP_KEY_HASH en .env.local
npm run dev                                         # http://127.0.0.1:3000/setup
```

Los correos locales (invitaciones y recuperación) se ven en Mailpit: <http://127.0.0.1:54324>.

## Pruebas

- `npm test`: hash y verificación de la clave, límites de intentos, validaciones, redirecciones seguras y origen público.
- `npm run test:db`: 53 pruebas pgTAP, incluida la de que la administración sin `aal2` no obtiene permisos.
- `npm run test:e2e` (`e2e/01-cuentas.spec.ts`), que reinicia la base local, compila y ejecuta Playwright. Recorre:
  - que no hay registro público;
  - la redirección de rutas protegidas a `/entrar`;
  - la clave de alta incorrecta y la correcta, con MFA obligatoria;
  - `/setup` → 410 tras el alta;
  - la invitación por correo y la creación de contraseña;
  - que una consultora no entra a la administración;
  - la recuperación por correo y que el enlace no sirve dos veces;
  - la suspensión, que bloquea el acceso;
  - la ventana explicativa con foco de teclado.

  Con `E2E_CHROME_PATH` se usa un Chrome del sistema; con `E2E_CAPTURAS=<carpeta>` se guardan capturas.
