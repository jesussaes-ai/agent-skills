# Lista de seguridad

Qué protege la app, cómo se comprueba y qué falta. Las casillas marcadas con **(auto)** las revisa `src/modulos/seguridad/seguridad.test.ts` o pgTAP en cada ejecución; el resto se revisa a mano antes de cada despliegue.

## Llaves y secretos

- [x] **(auto)** Solo tres variables públicas (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`); ninguna es secreta.
- [x] **(auto)** La llave de servicio (`SUPABASE_SERVICE_ROLE_KEY`) solo aparece en código de servidor: nunca en componentes de cliente ni en módulos que estos importen.
- [x] **(auto)** Los componentes de cliente no importan `node:crypto`, el cliente de servidor de Supabase ni variables privadas.
- [x] **(auto)** `.env` y `.env*.local` están en `.gitignore`; `.env.example` deja vacías las líneas de secretos.
- [x] **(auto)** Los scripts no imprimen valores de variables de entorno, tokens ni contraseñas.
- [x] La clave de alta se guarda como hash argon2id (`ADMIN_SETUP_KEY_HASH`) y sirve una sola vez.
- [x] Las llaves de IA se guardan como secretos del hosting (`LLM_KEY_…`); la base solo guarda su nombre.
- [ ] Rotar la llave de servicio y `ADMIN_SETUP_KEY_HASH` si alguna vez se expusieron (procedimiento en [cuentas-y-acceso.md](cuentas-y-acceso.md)).

## Base de datos (RLS)

- [x] **(auto)** Cada tabla nueva de las migraciones activa RLS; sin política, se deniega (`01_estructura` lo comprueba también en la base).
- [x] **(auto)** `anon` no tiene privilegios; las funciones `security definer` fijan `search_path = ''`.
- [x] **(auto)** Enlaces para compartir: solo con el permiso `compartir`; solo se pueden revocar (no reactivar, ampliar ni borrar); la vigencia respeta el tope de `/admin/ajustes`; la base guarda el SHA-256 del token (`09_compartir_retencion`).
- [x] **(auto)** La auditoría es de solo inserción; solo la purga borra filas más antiguas que el plazo configurado (mínimo 365 días).
- [x] **(auto)** `usar_enlace_compartido`, `consumir_limite` y `purgar_registros_vencidos` solo los ejecuta el rol de servicio.

## Registros sin datos sensibles

- [x] **(auto)** La app no escribe en consola (`console.*`), así que los registros del hosting no reciben datos de personas.
- [x] La auditoría guarda quién, qué, cuándo y sobre qué recurso, sin copiar contenido. Los enlaces públicos registran la IP recortada (/24 en IPv4, /48 en IPv6), nunca la completa.
- [x] **(auto)** La auditoría de enlaces no contiene el token ni su hash.
- [x] Los límites de frecuencia guardan `sha256(regla|identificador)`: ni IP ni usuario en claro. Se purgan tras un día.
- [x] El consumo de IA se registra sin prompts ni respuestas.

## Límites de frecuencia

Tabla compartida `limites_frecuencia` (ventana fija), con respaldo en memoria si la base no responde. Reglas en `src/modulos/seguridad/reglas.ts`:

| Acción | Máximo | Ventana | Por |
|---|---|---|---|
| Entrar (solo intentos fallidos) | 10 | 15 min | IP + usuario |
| Verificación en dos pasos (solo códigos fallidos) | 10 | 15 min | cuenta |
| Alta inicial `/setup` | 5 | 15 min | IP |
| Cambiar contraseña | 10 | 15 min | cuenta |
| Crear cuentas | 30 | 1 h | administración |
| Descargar documento | 60 | 10 min | cuenta |
| Exportar expediente | 20 | 10 min | cuenta |
| Generar PDF | 30 | 10 min | cuenta |
| Crear enlace para compartir | 30 | 1 h | cuenta |
| Abrir o descargar un enlace público | 60 | 10 min | IP |
| Asistente de la app | 10 | 1 min | IP |
| Bot de la biblioteca | 20 | 1 min | cuenta |

Al superarlo, la interfaz dice cuánto esperar y las rutas responden 429 con `Retry-After`. Supabase Auth aplica además sus propios límites.

## Cabeceras HTTP (`next.config.ts`)

- [x] `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin`, `Permissions-Policy` (micrófono solo para la propia app; cámara y ubicación desactivadas).
- [x] `/compartido/*`: `Referrer-Policy: no-referrer` (el token no se filtra a otros sitios), `X-Robots-Tag: noindex` y sin caché.
- [x] `Content-Security-Policy` con *nonce* por petición (`src/modulos/seguridad/csp.ts`, aplicada en `proxy.ts`): scripts solo con el *nonce* (`'strict-dynamic'`, sin `eval` en producción), `frame-ancestors 'none'`, `object-src 'none'` y conexiones solo a la propia app y a Supabase (subida directa a Storage). Los estilos admiten `'unsafe-inline'` porque React escribe atributos `style`.

## Accesibilidad (WCAG 2.2 AA)

- [x] **(auto)** e2e `09-accesibilidad.spec.ts` pasa axe (reglas WCAG 2.0/2.1/2.2 A y AA) en las pantallas públicas, las de administración, el expediente y los enlaces compartidos.
- [x] Salto al contenido, foco visible en botones y enlaces, ventanas explicativas con `aria-describedby`, mensajes de error con `role="alert"`.
- [ ] Revisión manual con lector de pantalla (NVDA o VoiceOver) y zoom al 200 % antes de abrir a clientes.

## Antes de cada despliegue

1. `npm test`, `npm run typecheck`, `npm run build`, `npm run test:db` y `npm run test:e2e` en verde (el CI los ejecuta).
2. Revisar los asesores de seguridad de Supabase (*Advisors → Security*) en el proyecto remoto.
3. Confirmar que el registro público de Auth sigue desactivado.
4. Confirmar que la purga programada (`circulo-nueve-tareas`) corrió en las últimas 24 h.
