# Cuentas y acceso

Estado: **funciona con Supabase local** y está probado de extremo a extremo. No hay proyecto Supabase remoto.

Las cuentas usan **usuario y contraseña**. No se usa correo para nada: no hace falta SMTP ni dominio propio.

## Tipos de cuenta

| Tipo (rol) | Qué puede hacer |
|---|---|
| **Administración** (`admin`) | Control total: todos los expedientes, usuarios, ajustes, proveedores de IA y biblioteca. |
| **Asistente** (`consultor`) | **Nada por defecto.** Solo lo que la administración le marque en su cuenta (tabla `user_permissions`): «crear y gestionar sus propios expedientes», «compartir sus propios expedientes», «ver y descargar todos (solo lectura)» y «administrar la biblioteca». Sus expedientes quedan separados de los de las demás asistentes. |
| **Cliente** (`cliente`) | Solo ve, en lectura, el expediente vinculado a su cuenta (`case_files.client_user_id`): perfil, lecturas y PDF. No crea, no modifica, no genera PDF, no consulta la biblioteca. |

## Flujo

| Paso | Ruta | Qué ocurre |
|---|---|---|
| Alta inicial | `/setup` | La administración elige **usuario y contraseña**. La clave de alta se compara solo en el servidor con el hash argon2id de `ADMIN_SETUP_KEY_HASH`. Si es correcta, se crea la cuenta y `completar_alta_admin` asigna el rol `admin` dentro de una transacción con bloqueo. Funciona una sola vez: después, el proxy responde **410**. Lleva a `/cuenta?bienvenida=1`, que recomienda activar la verificación en dos pasos. |
| Entrar | `/entrar` → `/entrar/verificar` | Usuario y contraseña. Si la cuenta tiene la verificación en dos pasos activada, se pide el código (sesión `aal2`). |
| Verificación en dos pasos | `/cuenta/verificacion` | **Opcional y recomendada.** Se activa y desactiva desde «Mi cuenta». Para desactivarla hay que haber entrado con el código. |
| Crear cuenta | `/admin/usuarios` | La administración escribe nombre, usuario, tipo de cuenta y, para asistentes, los permisos. La contraseña inicial la escribe ella o la genera la app (se muestra una sola vez). Puede marcar «Pedirle que elija su propia contraseña al entrar por primera vez». |
| Cambio obligatorio | `/cuenta/contrasena?obligatorio=1` | Mientras esté pendiente, la app lleva siempre a esta página y la base de datos no concede ningún acceso. Solo se libera si la contraseña nueva es distinta de la provisional. |
| Restablecer contraseña | `/admin/usuarios` | La administración pone una contraseña nueva (escrita o generada), con o sin cambio obligatorio. Queda en la auditoría. |
| Enlace de recuperación (alternativa) | `/admin/usuarios` | Enlace `token_hash` de un solo uso (caduca en 1 h) para que la persona elija su contraseña. Queda en la auditoría. |
| Olvidé mi contraseña | `/recuperar` | Explica que hay que pedirla a la administración. No envía nada. |
| Suspender, revocar o reactivar | `/admin/usuarios` | Cambia `user_profiles.status` (RLS lo aplica de inmediato) y bloquea o desbloquea el inicio de sesión en Auth. |
| Tipo de cuenta y permisos | `/admin/usuarios` | Asignar o retirar roles; «Guardar permisos» reemplaza los permisos de una asistente. Nadie puede cambiar sus propios roles, permisos ni estado. |

## Cómo se guarda el usuario

Supabase Auth necesita un correo. Cada cuenta usa uno **interno, no entregable**: `<usuario>@usuarios.circulo-nueve.invalid` (el dominio `.invalid` está reservado por el RFC 2606 y nunca resuelve). No aparece en la interfaz. Al entrar, el servidor traduce el usuario a ese correo con `correo_de_usuario()` (solo con la llave de servicio) y responde lo mismo exista o no la cuenta.

El usuario vive en `user_profiles.username`: de 3 a 32 caracteres, empieza por letra, solo `a-z`, `0-9`, `.`, `_` y `-`; se guarda en minúsculas y es único (lo comprueba también la base).

## Garantías y dónde se aplican

- **No hay registro público.** Se cierra con `[auth] enable_signup = false` y lo comprueba una prueba e2e. Ojo: en la CLI, `[auth.email] enable_signup` debe quedarse en `true`, porque si no se apaga también el inicio de sesión.
- **La verificación en dos pasos, si está activada, se exige en la base.** `es_usuario_activo()` exige `nivel_mfa_suficiente()`: si la cuenta tiene un factor TOTP verificado, toda sesión que no sea `aal2` se queda sin permisos (ni expedientes, ni administración), aunque la contraseña sea correcta. Sin factor, basta la contraseña. Esto vale para todos los roles, incluida la administración (migración `…20261007000100`).
- **El cambio obligatorio de contraseña se exige en la base.** `es_usuario_activo()` es falso mientras `debe_cambiar_contrasena` esté marcado. `confirmar_cambio_contrasena()` solo lo libera si el hash guardado en Auth cambió respecto al que se anotó al exigirlo.
- **Las asistentes no tienen permisos por rol.** `role_permissions` ya no concede nada a `consultor`; `has_perm` y `has_global_perm` suman los de `user_permissions`, que solo puede escribir la administración (y nunca sobre sí misma). El alcance «propio» limita a expedientes creados por la persona o asignados.
- **Los clientes solo leen.** Su único acceso es el expediente vinculado (listar y abrir/descargar). Crear documentos exige `modificar`, así que tampoco pueden generar PDF. `niveles_acceso_permitidos()` les devuelve una lista vacía: no ven fuentes de la biblioteca.
- **La autorización vive en el servidor.** Las acciones de servidor validan con Zod. Las operaciones con la llave de servicio (crear cuentas en Auth, restablecer contraseñas, bloquear, resolver el usuario) se ejecutan solo después de comprobar el rol y el permiso de quien llama. Perfiles, roles y permisos se escriben con la sesión del usuario, así que RLS también los comprueba.
- **Límites de intentos** en memoria por instancia: alta 5/15 min, entrar 10/15 min por IP y usuario, MFA 10/15 min. Supabase Auth aplica además sus propios límites.
- **Redirecciones seguras:** `next` solo acepta rutas internas. Las URL absolutas se construyen con `NEXT_PUBLIC_SITE_URL` o con el `Host` de la petición.
- **Auditoría:** cambios de estado, rol, permisos, contraseñas restablecidas y enlaces generados quedan en `audit_log`, sin datos personales.
- **Contraseñas:** al menos 10 caracteres, con letras y números (en Zod y en `[auth] password_requirements`). Las generadas tienen el formato `abc2-def3-ghj4-kmn5` (sin caracteres ambiguos).

## Clave de alta: generar, rotar, un solo uso

```bash
npm run setup:hash               # escribe la clave (no se muestra); imprime el hash
npm run setup:hash -- --generar  # genera una clave aleatoria, la muestra una vez e imprime el hash
```

- Carga el hash como secreto `ADMIN_SETUP_KEY_HASH` (en `.env.local` en local; en el hosting, como variable secreta).
- **Rotar antes del alta:** genera otro hash y reemplaza el secreto; la clave anterior deja de servir.
- **Después del alta,** la clave ya no sirve aunque siga cargada: `app_setup.completed_at` está fijado y `/setup` responde 410.
- **Recuperación de emergencia** (si se pierde el acceso de administración): `npm run admin:emergencia -- --usuario <usuario> --motivo "…"`; ver [recuperacion-emergencia.md](recuperacion-emergencia.md).

## Ejecutar en local

```bash
npm run db:start                                    # Supabase local con Auth y Storage
npx supabase status -o env                          # copia API_URL, ANON_KEY y SERVICE_ROLE_KEY a .env.local
npm run setup:hash -- --generar                     # copia el hash a ADMIN_SETUP_KEY_HASH en .env.local
npm run dev                                         # http://127.0.0.1:3000/setup
```

## Pruebas

- `npm test`: hash y verificación de la clave, límites de intentos, validación de usuario y contraseña, correo interno, contraseñas generadas, redirecciones seguras y origen público.
- `npm run test:db`: pruebas pgTAP. `08_cuentas_usuario.test.sql` cubre el formato y la unicidad del usuario, que una asistente sin permisos no ve nada, que no puede darse permisos, que el cliente lee su expediente pero no crea documentos ni consulta la biblioteca, el cambio obligatorio de contraseña y que una cuenta con factor TOTP sin `aal2` no obtiene permisos.
- `npm run test:e2e` (`e2e/01-cuentas.spec.ts`), que reinicia la base local, compila y ejecuta Playwright. Recorre:
  - que no hay registro público y que las rutas protegidas llevan a `/entrar`;
  - el alta con clave incorrecta (conserva el usuario) y correcta, sin MFA obligatoria;
  - la activación de la verificación en dos pasos desde el perfil y que después se exige;
  - `/setup` → 410 tras el alta;
  - la creación de una asistente con contraseña generada y de un cliente con contraseña escrita;
  - el cambio obligatorio en el primer acceso (rechaza repetir la provisional);
  - que una asistente sin permisos no ve ni crea expedientes;
  - que el cliente solo ve su expediente y sin botones de modificación;
  - el restablecimiento de contraseña desde el panel y la suspensión;
  - el mismo mensaje para usuario inexistente y contraseña errónea;
  - la ventana explicativa con foco de teclado.

  `e2e/07-biblioteca-multimedia.spec.ts` prueba además el enlace de recuperación de un solo uso. Con `E2E_CHROME_PATH` se usa un Chrome del sistema; con `E2E_CAPTURAS=<carpeta>` se guardan capturas.
