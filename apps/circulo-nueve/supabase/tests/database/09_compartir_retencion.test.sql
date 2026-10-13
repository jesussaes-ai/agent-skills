-- Enlaces compartidos (crear solo con permiso, vencer, revocar, auditar sin
-- token), retención configurable de enlaces y auditoría, límites de frecuencia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'asistente-a@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'asistente-b@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'asistente-d@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.user_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Asistente A'),
  ('00000000-0000-0000-0000-0000000000b1', 'Asistente B'),
  ('00000000-0000-0000-0000-0000000000d1', 'Asistente D sin compartir'),
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente C');
insert into public.user_roles (user_id, role_id, granted_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000d1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente', '00000000-0000-0000-0000-00000000000a');
insert into public.user_permissions (user_id, permission_id, alcance)
  select u, p, 'propio' from
    unnest(array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1']::uuid[]) as u,
    unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar', 'borrar', 'compartir']) as p;
insert into public.user_permissions (user_id, permission_id, alcance)
  select '00000000-0000-0000-0000-0000000000d1', p, 'propio' from unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar']) as p;

insert into public.case_files (id, display_label, created_by, client_user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Expediente A', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Expediente B', '00000000-0000-0000-0000-0000000000b1', null),
  ('dddddddd-0000-0000-0000-00000000000d', 'Expediente D', '00000000-0000-0000-0000-0000000000d1', null);
insert into public.documents (id, case_file_id, storage_path, version_plantilla) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/a.pdf', 'v1'),
  ('22222222-0000-0000-0000-00000000000b', 'bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000001/b.pdf', 'v1');

-- ---------------------------------------------------------------- asistente A (tiene compartir)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.share_links (id, case_file_id, document_id, token_hash, alcance, expires_at, created_by, max_accesos)
     values ('5a5a5a5a-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', '11111111-0000-0000-0000-00000000000a',
             repeat('a', 64), 'documento', now() + interval '2 days', '00000000-0000-0000-0000-0000000000a1', 2) $$,
  'la asistente con permiso de compartir crea un enlace a su PDF'
);
select lives_ok(
  $$ insert into public.share_links (id, case_file_id, token_hash, alcance, expires_at, created_by)
     values ('5a5a5a5a-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001',
             repeat('b', 64), 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1') $$,
  'y un enlace a los PDF de todo el expediente'
);
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('c', 64), 'expediente', now() + interval '8 days', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'no puede pasar de la vigencia máxima (7 días por defecto)'
);
select throws_ok(
  $$ insert into public.share_links (case_file_id, document_id, token_hash, alcance, expires_at, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '22222222-0000-0000-0000-00000000000b', repeat('d', 64), 'documento', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'no puede enlazar un documento de otro expediente'
);
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'TOKEN-EN-CLARO', 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1') $$,
  '23514', null,
  'solo se guarda un hash SHA-256, nunca el token'
);
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by, revoked_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('e', 64), 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000a1', now()) $$,
  '42501', null,
  'no se crea un enlace ya revocado ni con accesos'
);
select throws_ok(
  $$ update public.share_links set expires_at = now() + interval '6 days' where id = '5a5a5a5a-0000-0000-0000-000000000002' $$,
  '42501', null,
  'no se puede alargar la vigencia: solo revocar'
);
select lives_ok(
  $$ update public.share_links set revoked_at = now() where id = '5a5a5a5a-0000-0000-0000-000000000002' $$,
  'la asistente revoca su enlace'
);
select is(
  (select revoked_by from public.share_links where id = '5a5a5a5a-0000-0000-0000-000000000002'),
  '00000000-0000-0000-0000-0000000000a1'::uuid,
  'queda quién lo revocó'
);
select throws_ok(
  $$ update public.share_links set revoked_at = null where id = '5a5a5a5a-0000-0000-0000-000000000002' $$,
  'P0001', null,
  'una revocación no se deshace'
);
delete from public.share_links;
select is((select count(*) from public.share_links), 2::bigint, 'nadie borra enlaces desde la app (solo la purga)');

-- ---------------------------------------------------------------- sin permiso
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.share_links), 0::bigint, 'otro asistente no ve enlaces ajenos');
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('f', 64), 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'otro asistente no comparte un expediente ajeno'
);
update public.share_links set revoked_at = now() where id = '5a5a5a5a-0000-0000-0000-000000000001';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by)
     values ('dddddddd-0000-0000-0000-00000000000d', repeat('1', 64), 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000d1') $$,
  '42501', null,
  'una asistente sin el permiso de compartir no comparte ni su propio expediente'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.share_links (case_file_id, token_hash, alcance, expires_at, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', repeat('2', 64), 'expediente', now() + interval '1 day', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null,
  'la persona cliente (solo lectura) no crea enlaces'
);
select throws_ok(
  $$ select public.usar_enlace_compartido(repeat('a', 64)) $$,
  '42501', null,
  'las cuentas no pueden usar la función pública de enlaces (solo el servidor)'
);
select throws_ok(
  $$ select public.consumir_limite(repeat('0', 64), 1, 60) $$,
  '42501', null,
  'ni la de límites de frecuencia'
);
update public.app_settings set retencion_enlaces_dias = 1;

-- ---------------------------------------------------------------- administración
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select is((select count(*) from public.share_links), 2::bigint, 'la administración ve todos los enlaces');
select is(
  (select revoked_at from public.share_links where id = '5a5a5a5a-0000-0000-0000-000000000001'),
  null,
  'otro asistente no pudo revocar un enlace ajeno'
);
select is((select retencion_enlaces_dias from public.app_settings), 90, 'una cuenta sin administración no cambió la retención');
select throws_ok(
  $$ update public.app_settings set retencion_auditoria_dias = 30 $$,
  '23514', null,
  'la auditoría se conserva al menos 365 días'
);
select lives_ok(
  $$ update public.app_settings set enlace_vigencia_max_dias = 14, retencion_enlaces_dias = 30 $$,
  'la administración configura vigencia máxima y retención'
);

-- ---------------------------------------------------------------- servidor (llave de servicio)
reset role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select is(
  public.usar_enlace_compartido(repeat('a', 64)) ->> 'estado', 'ok',
  'el enlace vigente abre la lista'
);
select is(
  jsonb_array_length(public.usar_enlace_compartido(repeat('a', 64)) -> 'documentos'), 1,
  'con un solo documento'
);
select is(
  public.usar_enlace_compartido(repeat('a', 64), '11111111-0000-0000-0000-00000000000a') ->> 'accesos', '1',
  'descargar cuenta un acceso'
);
select is(
  public.usar_enlace_compartido(repeat('a', 64), '22222222-0000-0000-0000-00000000000b') ->> 'estado', 'documento_no_disponible',
  'no sirve para descargar documentos fuera de su alcance'
);
select is(
  public.usar_enlace_compartido(repeat('a', 64), '11111111-0000-0000-0000-00000000000a') ->> 'estado', 'ok',
  'segundo acceso permitido'
);
select is(
  public.usar_enlace_compartido(repeat('a', 64), '11111111-0000-0000-0000-00000000000a') ->> 'estado', 'agotado',
  'al llegar al máximo de accesos deja de funcionar'
);
select is(public.usar_enlace_compartido(repeat('b', 64)) ->> 'estado', 'revocado', 'el enlace revocado deja de funcionar');
select is(public.usar_enlace_compartido(repeat('9', 64)) ->> 'estado', 'no_existe', 'un token desconocido no existe');

insert into public.share_links (id, case_file_id, token_hash, alcance, created_at, expires_at, created_by) values
  ('5a5a5a5a-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', repeat('3', 64), 'expediente',
   now() - interval '40 days', now() - interval '35 days', '00000000-0000-0000-0000-0000000000a1');
select is(public.usar_enlace_compartido(repeat('3', 64)) ->> 'estado', 'vencido', 'el enlace vencido deja de funcionar');

select ok(
  (select count(*) from public.audit_log where recurso_tipo = 'share_links' and accion in ('abrir_enlace', 'descargar_enlace')) >= 8
  and exists (select 1 from public.audit_log where accion = 'revocar_enlace' and actor_id = '00000000-0000-0000-0000-0000000000a1')
  and exists (select 1 from public.audit_log where accion = 'descargar_enlace' and detalle ->> 'resultado' = 'agotado'),
  'creación, revocación, accesos e intentos fallidos quedan auditados'
);
select is(
  (select count(*) from public.audit_log a, public.share_links s where a.detalle::text like '%' || s.token_hash || '%'),
  0::bigint,
  'la auditoría nunca guarda el hash del token'
);

select is(public.consumir_limite(repeat('0', 64), 2, 60), 0, 'límite: primer intento permitido');
select is(public.consumir_limite(repeat('0', 64), 2, 60), 0, 'límite: segundo intento permitido');
select ok(public.consumir_limite(repeat('0', 64), 2, 60) > 0, 'límite: el tercero espera');
select is(public.consumir_limite(repeat('1', 64), 2, 60, 0), 0, 'límite: consultar no cuenta un intento');
select is(public.consumir_limite(repeat('1', 64), 2, 60, 2), 0, 'límite: dos fallos registrados');
select ok(public.consumir_limite(repeat('1', 64), 2, 60, 0) > 0, 'límite: la consulta ya indica espera');

insert into public.audit_log (accion, recurso_tipo, created_at) values ('prueba_antigua', 'registros', now() - interval '800 days');
select throws_ok(
  $$ delete from public.audit_log where accion = 'prueba_antigua' $$,
  'P0001', 'audit_log es de solo inserción',
  'fuera de la purga, la auditoría sigue siendo de solo inserción'
);
select is(
  public.purgar_registros_vencidos() - 'limites',
  '{"enlaces": 1, "auditoria": 1}'::jsonb,
  'la purga borra el enlace vencido hace más de 30 días y la auditoría de más de 730'
);
select ok(
  exists (select 1 from public.share_links where id = '5a5a5a5a-0000-0000-0000-000000000002')
  and exists (select 1 from public.audit_log where accion = 'purga_retencion' and recurso_tipo = 'registros'),
  'conserva el enlace revocado reciente y deja constancia de la purga'
);

select * from finish();
rollback;
