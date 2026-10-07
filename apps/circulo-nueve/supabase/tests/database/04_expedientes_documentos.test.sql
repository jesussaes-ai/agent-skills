-- Consentimiento exigido por la base, vinculación de clientes, permisos por
-- archivo, retención de documentos y recuperación de emergencia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'consultora-a@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor-b@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.user_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Consultora A'),
  ('00000000-0000-0000-0000-0000000000b1', 'Consultor B'),
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente C');
insert into public.user_roles (user_id, role_id, granted_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente', '00000000-0000-0000-0000-00000000000a');
insert into public.user_permissions (user_id, permission_id, alcance)
  select ur.user_id, p, 'propio' from public.user_roles ur,
    unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar', 'borrar', 'compartir']) as p
  where ur.role_id = 'consultor';
insert into public.case_files (id, display_label, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Expediente A (demo)', '00000000-0000-0000-0000-0000000000a1');
insert into public.readings (id, case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}');
insert into public.documents (id, case_file_id, storage_path, version_plantilla) values
  ('dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/44444444-4444-4444-4444-444444444444.pdf', 'v1');
insert into storage.objects (bucket_id, name) values
  ('expedientes', 'aaaaaaaa-0000-0000-0000-000000000001/44444444-4444-4444-4444-444444444444.pdf');

select is(
  (select retener_hasta from public.documents where id = 'dddddddd-0000-0000-0000-000000000001'),
  current_date + 365,
  'la retención por defecto es de 365 días'
);

-- ---------------------------------------------------------------- consultora A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.birth_profiles (case_file_id, birth_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nombre Demo') $$,
  'CN001', null,
  'sin consentimiento no se guarda el perfil'
);
select throws_ok(
  $$ insert into public.readings (case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}', '00000000-0000-0000-0000-0000000000a1') $$,
  'CN001', null,
  'sin consentimiento no se guardan lecturas'
);
select lives_ok(
  $$ insert into public.consents (case_file_id, tipo, otorgado, version_texto) values
       ('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_perfil', true, 'v1'),
       ('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_historial', true, 'v1') $$,
  'la consultora registra los consentimientos'
);
select lives_ok(
  $$ insert into public.birth_profiles (case_file_id, birth_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nombre Demo') $$,
  'con consentimiento se guarda el perfil'
);
select ok(public.consentimiento_vigente('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_historial'), 'el consentimiento está vigente');
select lives_ok(
  $$ insert into public.consents (case_file_id, tipo, otorgado, version_texto) values ('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_historial', false, 'v1') $$,
  'se puede retirar el consentimiento'
);
select ok(not public.consentimiento_vigente('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_historial'), 'el último registro manda: ya no está vigente');
select throws_ok(
  $$ insert into public.readings (case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}', '00000000-0000-0000-0000-0000000000a1') $$,
  'CN001', null,
  'tras retirar el consentimiento no se guardan lecturas'
);
select lives_ok(
  $$ update public.case_files set client_user_id = '00000000-0000-0000-0000-0000000000c1' where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  'la consultora vincula una cuenta cliente a su expediente (tiene compartir)'
);

-- ---------------------------------------------------------------- consultor B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.documents), 0::bigint, 'consultor B no ve el documento');
select is((select count(*) from storage.objects where bucket_id = 'expedientes'), 0::bigint, 'consultor B no ve el archivo');
select throws_ok(
  $$ select public.registrar_acceso('descargar', 'documents', 'dddddddd-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null,
  'consultor B no puede registrar una descarga ajena'
);

-- ---------------------------------------------------------------- administración da permiso de archivo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ insert into public.document_grants (document_id, user_id, granted_by)
     values ('dddddddd-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000a') $$,
  'administración da a B permiso sobre un archivo'
);

select lives_ok(
  $$ insert into public.case_file_grants (case_file_id, user_id, permissions, granted_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', '{listar,modificar}', '00000000-0000-0000-0000-00000000000a') $$,
  'administración da a la persona cliente permiso de modificar (sin compartir)'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$ update public.case_files set client_user_id = null where id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  '42501', null,
  'modificar no basta para cambiar la cuenta cliente vinculada'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.documents), 1::bigint, 'con permiso de archivo, B ve ese documento');
select is((select count(*) from public.case_files), 0::bigint, '…pero no el expediente');
select is((select count(*) from storage.objects where bucket_id = 'expedientes'), 1::bigint, '…y puede abrir el archivo');

reset role;
select throws_ok(
  $$ select public.recuperacion_emergencia_admin('00000000-0000-0000-0000-0000000000b1', 'corto') $$,
  'P0001', null,
  'la recuperación de emergencia exige un motivo'
);
select lives_ok(
  $$ select public.recuperacion_emergencia_admin('00000000-0000-0000-0000-0000000000b1', 'Prueba de recuperación de emergencia') $$,
  'la recuperación de emergencia asigna administración y queda auditada'
);

select * from finish();
rollback;
