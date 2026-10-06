# Despliegue paso a paso (gratuito)

Guía para poner Círculo Nueve en producción en cuanto existan las cuentas. Todo es de plan gratuito y para **uso personal no comercial**: Vercel Hobby no permite uso comercial.

Datos de los planes verificados el 6 oct 2026. Vuelve a comprobarlos antes de empezar:
[Supabase pricing](https://supabase.com/pricing) · [regiones de Supabase](https://supabase.com/docs/guides/platform/regions) · [límites de Vercel](https://vercel.com/docs/functions/limitations) · [GitHub Actions](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Cómo queda

| Pieza | Servicio gratuito | Para qué |
|---|---|---|
| App web (Next.js) | **Vercel Hobby** (funciones en `iad1`, Washington D. C.) | Páginas, cuentas, expedientes, PDF, bot |
| Base de datos, Auth y archivos | **Supabase Free**, región **East US (North Virginia) `us-east-1`** | Postgres + RLS, Auth con MFA, Storage privado |
| Worker de ingesta, ping anti-pausa y purga | **GitHub Actions** (workflow `circulo-nueve-tareas`) | OCR, transcripción, figuras y embeddings; mantener activo Supabase; borrar documentos vencidos |
| Correo (invitaciones y recuperación) | Opcional: SMTP gratuito con dominio propio (p. ej. Brevo, 300/día) | Sin SMTP: enlaces de un solo uso que la administración comparte |
| IA para redactar respuestas (opcional) | Proveedor en `/admin/proveedores` | Sin proveedor, el bot responde con citas literales |

**Por qué `us-east-1`:** Supabase no tiene región en México. Las más cercanas son `us-east-1` (Virginia), `us-east-2` (Ohio) y `us-west-1` (California). `us-east-1` coincide con la región por defecto de las funciones de Vercel (`iad1`), así que cada consulta de la app a la base viaja dentro de la misma zona. Esa latencia pesa más que la del navegador, porque cada página hace varias consultas. Si en tus pruebas `us-west-1` responde notablemente mejor desde tu ciudad, puedes elegirla, pero entonces cambia también la región de funciones de Vercel a `sfo1`.

**Límites que importan (plan gratuito):**
- **Supabase:**
  - 500 MB de base de datos, 1 GB de archivos y 50 MB por archivo.
  - **Pausa tras 1 semana sin actividad** (lo evita el ping).
  - **Sin respaldos automáticos** (ver «Respaldos»).
  - Máximo 2 proyectos activos.
- **Vercel Hobby:**
  - Funciones de 300 s como máximo y cuerpo de petición de **4.5 MB**. Por eso los archivos de más de 4 MB se suben directo a Storage.
  - El OCR, la transcripción y los embeddings de documentos largos **no** corren en Vercel: los hace el worker.
- **GitHub Actions:** 2000 minutos al mes en repos privados. El workflow corre cada 6 horas (~3–5 min si no hay trabajos pesados) y cabe con margen. Los `schedule` solo corren en la **rama por defecto**.

## 0. Antes de empezar

- [ ] Cuenta de GitHub con el repositorio. Mientras la app viva en `agent-skills`, la PR debe estar fusionada en `main` para que corra el workflow programado.
- [ ] Cuenta de [Supabase](https://supabase.com) (plan Free).
- [ ] Cuenta de [Vercel](https://vercel.com) (plan Hobby) conectada a GitHub.
- [ ] En tu PC:
  - [Node.js 22](https://nodejs.org) y Git.
  - [Docker Desktop](https://www.docker.com/products/docker-desktop/), solo para respaldos y para la base local.
  - Un gestor de contraseñas (la frase de la base, la clave de alta y la del respaldo van ahí, nunca en chats ni documentos).
- [ ] Copia local, en PowerShell:
  ```powershell
  cd C:\Users\<usuario>\Proyectos\circulo-nueve\apps\circulo-nueve   # o la raíz del repo propio
  npm ci
  ```

## 1. Supabase

1. **Crear el proyecto:** *New project* → nombre `circulo-nueve` → **Region: East US (North Virginia)** → contraseña de la base generada y guardada en el gestor → plan Free.
2. **Aplicar el esquema** (migraciones de `supabase/migrations`) desde tu PC:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref-del-proyecto>    # el «ref» aparece en la URL del panel
   npx supabase db push                                   # aplica todas las migraciones
   npx supabase migration list                            # local y remoto deben coincidir
   ```
3. **Auth** (panel → *Authentication*):
   - *URL Configuration*:
     - **Site URL** = `https://<tu-app>.vercel.app`, o tu dominio.
     - **Redirect URLs**: `https://<tu-app>.vercel.app/**`.
   - *Sign In / Providers*:
     - Desactiva **Allow new users to sign up**: no hay registro público.
     - Deja **Email** activado, con confirmación de correo.
     - Contraseña mínima: **10** caracteres, con **letras y números**.
   - *Multi-Factor*: activa **TOTP**. Es obligatoria para administrar.
   - *Emails → Templates*: sustituye **Invite user** y **Reset password** por el contenido de `supabase/templates/invitacion.html` y `recuperacion.html`. Usan `token_hash` y llevan a `/auth/confirmar`.
   - Alternativa por CLI: `npx supabase config diff` y luego `npx supabase config push`. Antes, revisa que `site_url` y `additional_redirect_urls` de `supabase/config.toml` apunten a producción y no a `127.0.0.1`.
4. **Storage:** las migraciones ya crean los buckets privados. En *Storage → Settings* deja el límite global en **50 MB**.
5. **Llaves** (*Project Settings → API*). Apunta:
   - la **URL del proyecto**;
   - la llave pública (**anon / publishable**);
   - la **service_role / secret**. Esta es secreta: solo va en Vercel y en los secretos de GitHub.

## 2. Correo (opcional)

Sin SMTP propio, Supabase **solo envía correos a las direcciones del equipo de la organización del proyecto** (cambio anunciado en su [changelog](https://supabase.com/changelog/29370-supabase-auth-changes-to-default-email-provider)). Hay dos opciones:

- **Sin correo, gratis y sin dominio:**
  - En `/admin/usuarios`, marca «No enviar correo: mostrar el enlace para compartirlo yo».
  - El panel muestra un enlace de invitación de un solo uso, que caduca en 1 h. Compártelo por un canal privado.
  - Para recuperar la contraseña de alguien, usa «Enlace de recuperación» en su fila.
  - Ambos quedan en la auditoría.
- **Con correo:** hace falta un **dominio propio**, porque los servicios gratuitos exigen autenticar el dominio remitente (SPF/DKIM). Con [Brevo](https://www.brevo.com/free-smtp-server/), cuyo plan gratuito da 300 correos al día:
  1. Autentica el dominio.
  2. Crea una llave SMTP.
  3. En Supabase, *Authentication → Emails → SMTP Settings*: host `smtp-relay.brevo.com`, puerto `587`, usuario y llave SMTP, y remitente `no-reply@<tu-dominio>`.

## 3. Clave de alta de la administración

En tu PC, nunca en el servidor ni en un chat:

```bash
npm run setup:hash -- --generar
```

- Muestra **una sola vez** una clave aleatoria: guárdala en el gestor de contraseñas.
- Imprime el **hash argon2id**, que es lo que va a Vercel como `ADMIN_SETUP_KEY_HASH`.
- La clave en texto plano no se guarda en ninguna parte del sistema.
- **Rotar antes del alta:** genera otro hash y reemplaza la variable en Vercel (vuelve a desplegar). Después del alta, la clave deja de servir y `/setup` responde 410.

## 4. Vercel

1. *Add New → Project* → importa el repositorio.
2. **Root Directory**: `apps/circulo-nueve` (o la raíz, si ya es el repo propio). El framework es Next.js; no cambies los comandos.
3. Revisa que la región de funciones sea **Washington, D.C. (`iad1`)** (*Settings → Functions*).
4. **Variables de entorno** (*Settings → Environment Variables*, entorno *Production*):

   | Variable | Valor | ¿Secreta? |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase | no |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | llave pública (anon/publishable) | no |
   | `SUPABASE_SERVICE_ROLE_KEY` | llave service_role/secret | **sí** |
   | `NEXT_PUBLIC_SITE_URL` | `https://<tu-app>.vercel.app` | no |
   | `ADMIN_SETUP_KEY_HASH` | hash del paso 3 | **sí** |
   | `LLM_KEY_*` (opcional) | llave de un proveedor de IA, p. ej. `LLM_KEY_OPENROUTER` | **sí** |

   No definas `INGESTA_PERMITIR_HOSTS_LOCALES`: es solo para pruebas.
5. *Deploy*. Al terminar, abre `https://<tu-app>.vercel.app`.

## 5. Alta inicial y comprobaciones

1. **Alta:**
   - Abre `/setup`, escribe la clave de alta, tu nombre, correo y contraseña.
   - Configura la verificación en dos pasos (QR o clave secreta en tu aplicación de autenticación).
2. **Comprueba que `/setup` responde 410.**
3. **Revisa la configuración:**
   - En `/admin/ajustes`: retención de documentos, vigencia de los enlaces de descarga y **texto del aviso de privacidad** (lo redacta el responsable).
   - Invita a una cuenta de prueba (con enlace si no hay SMTP), entra con ella y comprueba que no ve la administración.
4. **Opcional, IA:** en `/admin/proveedores`, da de alta un proveedor con el nombre de su secreto `LLM_KEY_…` y pulsa «Probar conexión». Los modelos gratuitos solo sirven para demo, sin datos personales.

## 6. Worker de ingesta, ping anti-pausa y purga (GitHub Actions)

El workflow `.github/workflows/circulo-nueve-tareas.yml` corre cada 6 horas y también a mano (*Actions → Círculo Nueve tareas → Run workflow*). Pasos:

1. **Ping a Supabase:** una consulta mínima que cuenta como actividad y evita la pausa semanal.
2. **Worker:** procesa la cola de la biblioteca (`npm run ingesta:worker`). Instala ffmpeg para audio y video; ClamAV es opcional.
3. **Purga** de documentos con retención vencida (`npm run retencion:purgar`).

Configuración en *Settings → Secrets and variables → Actions*:

| Tipo | Nombre | Valor |
|---|---|---|
| Secret | `CIRCULO_NUEVE_SUPABASE_URL` | URL del proyecto |
| Secret | `CIRCULO_NUEVE_SERVICE_ROLE_KEY` | llave service_role |
| Variable | `CIRCULO_NUEVE_ACTIVO` | `true` (sin esto, el workflow no corre) |
| Variable | `CIRCULO_NUEVE_SITE_URL` | `https://<tu-app>.vercel.app` |
| Variable (opcional) | `CIRCULO_NUEVE_CLAMAV` | `true` para exigir antivirus. Suma ~2 min por ejecución: descarga firmas. |
| Variable (opcional) | `CIRCULO_NUEVE_VISION_PROVEEDOR_ID` | id de un proveedor con visión para describir figuras. Sin él, las figuras se describen con leyenda + OCR. |

**Cuándo procesa:**
- Los modelos (embeddings, Whisper, OCR) se descargan la primera vez (~700 MB) y quedan en la caché de Actions.
- Un archivo cargado se procesa en la siguiente ejecución, o al lanzarlo a mano.
- Para textos cortos, también sirve «Procesar pendientes ahora» en `/biblioteca`, que corre dentro de Vercel (máximo 300 s).

**Alternativa sin GitHub Actions:** deja el worker corriendo en tu PC mientras cargas libros. En PowerShell, con las dos variables de servicio:

```powershell
npm run ingesta:worker -- --continuo
```

Necesita ffmpeg en el `PATH` para audio y video.

## 7. Respaldos (manuales: el plan gratuito no tiene)

**Cada semana, o antes de cambios grandes**, desde tu PC con Docker Desktop abierto:

```bash
export SUPABASE_DB_URL="postgresql://postgres.<ref>:<contraseña>@aws-0-us-east-1.pooler.supabase.com:5432/postgres"   # Connect → Session pooler
export NEXT_PUBLIC_SUPABASE_URL="https://<ref>.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="<service_role>"
npm run respaldo        # pide la frase de cifrado (o define RESPALDO_CLAVE)
```

- Genera `~/respaldos-circulo-nueve/respaldo-AAAAMMDD-HHMM.tar.gz.gpg`, **cifrado con AES-256**. Contiene:
  - `roles.sql`, `esquema.sql` y `datos.sql`;
  - todos los archivos privados (expedientes, originales y derivados de la biblioteca).
- Contiene datos personales: guárdalo cifrado, fuera del repositorio, y en dos lugares (p. ej. disco externo y nube personal).
- **Restaurar en un proyecto nuevo y vacío** (sin `db push`: el esquema viaja en el respaldo):
  ```bash
  gpg -d respaldo-AAAAMMDD-HHMM.tar.gz.gpg | tar -xz && cd respaldo-AAAAMMDD-HHMM
  psql "$SUPABASE_DB_URL" -f roles.sql
  psql "$SUPABASE_DB_URL" -f esquema.sql
  psql "$SUPABASE_DB_URL" -c "SET session_replication_role = replica" -f datos.sql   # sin triggers mientras se cargan los datos
  npx tsx ../../scripts/restaurar-storage.mts storage    # desde apps/circulo-nueve, con las variables del proyecto nuevo
  ```
  `datos.sql` incluye las cuentas de Auth (`auth.users`, factores MFA) y los datos de `public` (comprobado en local). Después, vuelve a configurar Auth en el panel (paso 1.3) y actualiza las variables de Vercel y de Actions.

## 8. Mantenimiento

- **Cada semana:** respaldo.
- **Cada mes:** revisar el consumo en Supabase (base < 500 MB, archivos < 1 GB) y los minutos de Actions.
- **Si Supabase se pausó** (p. ej. porque el workflow estaba desactivado): *Restore project* en el panel, y vuelve a activar `CIRCULO_NUEVE_ACTIVO`.
- **Recuperación de emergencia** de la administración: [recuperacion-emergencia.md](recuperacion-emergencia.md).
- **Cambiar de modelo de embeddings** (otra dimensión): requiere una migración nueva y reindexar ([biblioteca.md](biblioteca.md)).

## Lista final

- [ ] Proyecto Supabase en `us-east-1`, migraciones aplicadas y Auth configurado (sin registro público, TOTP, plantillas).
- [ ] Vercel con las 5 variables, región `iad1` y despliegue verde.
- [ ] `/setup` completado y luego 410; MFA de la administración activa.
- [ ] Aviso de privacidad completado en `/admin/ajustes`.
- [ ] Secretos y variables de Actions; primera ejecución manual del workflow en verde.
- [ ] Primer respaldo cifrado guardado en dos lugares.
