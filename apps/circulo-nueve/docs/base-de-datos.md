# Base de datos (Supabase) — esquema y seguridad

Estado: **migraciones y pruebas locales listas**. No hay ningún proyecto Supabase remoto creado ni vinculado, y la app todavía no se conecta a la base de datos.

## Migraciones (`supabase/migrations/`)

| Archivo | Contenido |
|---|---|
| `…0100_base_identidad_permisos.sql` | Extensiones `vector` y `unaccent`; `app_setup`, `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`; funciones `es_usuario_activo`, `has_perm`, `has_global_perm`. Catálogo de roles (`admin`, `consultor`, `cliente`) y permisos. |
| `…0200_expedientes.sql` | `case_files`, `case_file_grants` (con vencimiento), `birth_profiles`, `consents`, `readings`, `documents`, `share_links` (vencen en ≤ 30 días), `privacy_notice_settings` (campos vacíos hasta que la persona responsable los complete); función `has_case_perm`. |
| `…0300_biblioteca_rag.sql` | `sources`, `source_versions` (hash SHA-256, una sola vigente), `ingestion_jobs`, `chunks` (FTS `spanish` sin acentos + `vector(1024)` con índice HNSW), `visual_assets`, `chunk_visual_links`; RPC `hybrid_search` (RRF) que filtra por nivel de acceso dentro de la función. |
| `…0400_proveedores_auditoria_alta.sql` | `ai_providers` (sin secretos: solo el nombre del secreto), `ai_usage` (sin prompts), `audit_log` de solo inserción con triggers, `registrar_acceso`, `completar_alta_admin` (una sola vez, solo service role). |
| `…2000_proveedores_llm_config.sql` | Columnas de `ai_providers` para tipo, modelos de respaldo, destinatarios, política, límites, costo y prioridad. Restricciones: secreto con prefijo `LLM_KEY_`, endpoint http(s), id «entorno» reservado, y lo gratuito o FreeLLMAPI nunca apto para datos reales. Políticas de alta y baja para `admin_proveedores` y auditoría. `ai_usage` con intento, latencia, origen y código validado. `ai_uso_actual()` solo para service role. Ver [proveedores-ia-y-voz.md](proveedores-ia-y-voz.md). |
| `…0500_storage.sql` | Buckets privados `cuarentena`, `biblioteca-originales`, `biblioteca-derivados`, `expedientes`; políticas de `storage.objects` según el expediente de la ruta `{uuid}/…`; revocación total al rol anónimo. |
| `…0800_biblioteca_ingesta.sql` | Biblioteca: origen, URL y derechos en `sources`; versiones con rutas, diferencias y advertencias; cola de trabajos (`tomar_trabajo_ingesta` atómica); fragmentos `vector(384)` con exclusión y marca de posible inyección; `hybrid_search` con umbral de similitud. Detalle: [biblioteca.md](biblioteca.md). |
| `…2100_consumo_llm_biblioteca.sql` | Permite el origen `biblioteca` en `ai_usage`. |

## Modelo de permisos

- **RLS activado en todas las tablas** de `public`; sin política, se deniega. El rol `anon` no tiene privilegios.
- Los permisos se consultan en tablas en cada operación: una suspensión o un cambio de rol surte efecto de inmediato.
- `has_case_perm(expediente, permiso)` es verdadero solo si la cuenta está **activa** y además:
  - el rol da ese permiso con alcance `global` (administración), o
  - el rol lo da con alcance `propio` y la persona creó el expediente (consultores), o
  - hay una asignación (`case_file_grants`) vigente que incluye el permiso, o
  - es la persona cliente del expediente y el permiso es `listar` o `abrir_descargar`.
- Nadie se autoasigna roles ni expedientes; tampoco la administración puede cambiar su propio estado.
- Los fragmentos de la biblioteca no se leen directamente: solo con `hybrid_search`, que aplica los niveles de acceso (`publico`, `consultores`, `admin`).
- La auditoría guarda quién, qué, cuándo y sobre qué recurso, sin copiar contenido; no se puede modificar ni borrar.

## Ejecutar en local

Requiere Docker (en Windows, Docker Desktop). La CLI de Supabase está como dependencia de desarrollo.

```bash
npm run db:start   # levanta Postgres, Auth, Storage y API locales
npm run db:reset   # aplica todas las migraciones desde cero
npm run test:db    # pruebas pgTAP de supabase/tests/database
npm run db:stop
```

Las claves que imprime `db:start` son las de demostración de la CLI local; no sirven fuera de tu máquina.

## Pruebas (`supabase/tests/database/`)

| Archivo | Qué comprueba |
|---|---|
| `01_estructura.test.sql` | RLS en todas las tablas, `anon` sin privilegios, buckets privados, funciones security definer con `search_path` fijo, pgvector e índice HNSW. |
| `02_aislamiento_expedientes.test.sql` | Seis cuentas ficticias: cada consultor solo ve y modifica sus expedientes, archivos y lecturas; la persona cliente solo lee el suyo; las asignaciones vencidas no dan acceso y las de solo lectura no permiten modificar; una cuenta suspendida no ve nada; sin autoasignación de roles ni expedientes; el alta inicial solo funciona una vez; la búsqueda respeta niveles de acceso; `anon` no lee nada. |
| `03_auditoria.test.sql` | La auditoría registra los cambios, no copia datos personales y no se puede modificar ni borrar. |

## Pendiente

- Crear el proyecto Supabase remoto (plan gratuito, región cercana a México) y vincularlo; requiere la cuenta de la persona propietaria.
- Conectar la app: Auth con registro desactivado e invitaciones, ruta `/setup` con verificación argon2id, MFA para administración.
- Pruebas de extremo a extremo con dos usuarios reales del Auth local.
