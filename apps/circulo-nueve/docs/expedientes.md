# Expedientes, lecturas y documentos

Estado: **funciona con Supabase local** y está probado de extremo a extremo.

## Qué hay en un expediente (`/expedientes/[id]`)

| Sección | Qué hace | Requiere |
|---|---|---|
| Resumen | Nombre del expediente, tus permisos efectivos y la cuenta cliente vinculada (solo administración). | `listar`; `modificar` para renombrar; `compartir` para vincular. |
| Consentimientos | `usar_conversacion`, `guardar_perfil`, `guardar_historial`, cada uno por separado. Cada cambio es un registro nuevo y manda el último. Envío externo y entrenamiento: desactivados. | `modificar` |
| Perfil de nacimiento | Separado del nombre del expediente; no se adivina nada. | `modificar` + consentimiento `guardar_perfil` (lo exige la base de datos) |
| Nueva lectura | «Calcular sin guardar» = **modo efímero**: se calcula en el navegador y no se guarda. «Guardar lectura» recalcula en el servidor y guarda motor, versión, reglas y la huella de las entradas. | `modificar` + consentimiento `guardar_historial` (lo exige la base de datos) |
| Historial | Lecturas con sus pasos; generar PDF; borrar. | `abrir_descargar` para el PDF; `borrar` para borrar |
| Documentos | PDF guardados en privado, con tamaño y fecha de retención. Descargar o borrar. La administración puede dar acceso a un solo archivo. | `abrir_descargar` o permiso de archivo |
| Permisos del expediente | La administración asigna permisos con vencimiento opcional y los retira. | Administración con `aal2` |
| Actividad registrada | Últimos eventos de la auditoría del expediente. | Administración |
| Exportar o borrar | JSON con perfil, consentimientos, lecturas y lista de documentos (auditado). Borrado total con confirmación «BORRAR», incluidos los archivos. | `abrir_descargar` / `borrar` |

El modo efímero sin cuenta sigue en la página de inicio: no hay sesión ni almacenamiento.

## Descarga de PDF

1. **Generar PDF:** el servidor comprueba `abrir_descargar` y genera el PDF con `src/reportes`. Lo sube al bucket privado `expedientes` en `{expediente}/{uuid}.pdf` y registra el documento con su SHA-256, tamaño y retención. El registro se hace con la sesión del usuario: RLS lo verifica y la auditoría guarda quién fue.
2. **Descargar** (`/expedientes/[id]/documentos/[documentoId]`):
   - El servidor lee el documento con la sesión del usuario (RLS: `has_document_perm`).
   - Registra la descarga en la auditoría (`registrar_acceso`).
   - Crea con esa misma sesión una URL firmada que vive `vigencia_url_firmada_segundos` (60 s por defecto; también la limita la RLS de `storage.objects`) y responde 303 hacia ella.
   - Si no hay permiso, o el documento no existe, responde 404 sin distinguir entre ambos casos.
   - Los enlaces de descarga no se precargan (`prefetch={false}`), para no generar registros de auditoría falsos.
3. **Retención:**
   - `documents.retener_hasta` se fija al crear el documento: hoy + `retencion_documentos_dias` (365 por defecto, configurable en `/admin/ajustes`).
   - `npm run retencion:purgar` (con la llave de servicio, a diario desde el cron del hosting) borra primero el archivo, después el registro, y deja constancia en la auditoría. Con `--simular` solo lista lo que borraría.

Los PDF leen fuentes e imágenes del disco con rutas desde `process.cwd()`. `next.config.ts` incluye `src/reportes/fuentes` y `src/reportes/marca` en las trazas del servidor para que viajen a las funciones de Vercel.

## Garantías en la base de datos (migración `…0700`)

- Sin el consentimiento vigente no se guardan perfil ni lecturas (error `CN001`). Solo se comprueba si quien escribe tiene permiso de modificar; si no, RLS rechaza la fila sin revelar que el expediente existe.
- Vincular o cambiar la cuenta cliente exige `compartir`.
- Permisos por archivo: `document_grants` + `has_document_perm`, aplicados también a `storage.objects`.
- Los documentos solo pueden apuntar a rutas de su propio expediente (`check`).
- `app_settings` (retención y vigencia de las URL), editable solo por la administración.

Nota técnica: en las tablas cuya política de lectura usa `has_case_perm` no se usa `insert … returning`, porque la función no ve la fila nueva dentro de la misma sentencia. Por eso los id se generan en el servidor.

## Pruebas

- pgTAP `04_expedientes_documentos.test.sql`: consentimiento exigido y retirable, vinculación de cliente, permisos por archivo, retención por defecto, auditoría de accesos y recuperación de emergencia.
- e2e `02-expedientes.spec.ts`, que recorre:
  - crear un expediente sin consentimiento (no se guarda nada);
  - consentimientos, perfil, lectura efímera frente a guardada;
  - PDF: 303 hacia una URL firmada, el archivo empieza por `%PDF-` y la descarga queda auditada;
  - exportación JSON;
  - otro consultor recibe 404 en detalle, descarga y exportación;
  - la administración asigna lectura y ve la actividad;
  - la persona asignada puede descargar pero no modificar;
  - la purga por retención borra archivo y registro;
  - el borrado total elimina también el almacenamiento;
  - el script de recuperación de emergencia.
