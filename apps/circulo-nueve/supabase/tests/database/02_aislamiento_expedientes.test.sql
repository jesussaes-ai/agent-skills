-- Aislamiento entre expedientes y personas, sin autoasignación de privilegios.
-- Todos los datos son ficticios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

-- Usuarios ficticios
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'consultora-a@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor-b@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'suspendida@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'sin-rol@demo.invalid', 'authenticated', 'authenticated');

-- Alta inicial (lo haría el servidor con service role)
select lives_ok(
  $$ select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo') $$,
  'el alta inicial crea al administrador'
);
select throws_ok(
  $$ select public.completar_alta_admin('00000000-0000-0000-0000-0000000000e1', 'Segundo admin') $$,
  'P0001', 'El alta inicial ya se completó',
  'el alta inicial no se puede repetir'
);

insert into public.user_profiles (user_id, display_name, status) values
  ('00000000-0000-0000-0000-0000000000a1', 'Consultora A', 'activo'),
  ('00000000-0000-0000-0000-0000000000b1', 'Consultor B', 'activo'),
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente C', 'activo'),
  ('00000000-0000-0000-0000-0000000000d1', 'Consultora suspendida', 'suspendido'),
  ('00000000-0000-0000-0000-0000000000e1', 'Sin rol', 'activo');
insert into public.user_roles (user_id, role_id, granted_by) values
  ('00000000-0000-0000-0000-0000000000a1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente', '00000000-0000-0000-0000-00000000000a'),
  ('00000000-0000-0000-0000-0000000000d1', 'consultor', '00000000-0000-0000-0000-00000000000a');

insert into public.case_files (id, display_label, created_by, client_user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Expediente A (demo)', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Expediente B (demo)', '00000000-0000-0000-0000-0000000000b1', null),
  ('dddddddd-0000-0000-0000-000000000001', 'Expediente D (demo)', '00000000-0000-0000-0000-0000000000d1', null);
insert into public.birth_profiles (case_file_id, birth_name, birth_date) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Ana María Núñez', '1990-07-15'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'Gina Demo', '1980-01-01');
insert into public.consents (case_file_id, tipo, otorgado, version_texto) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'guardar_historial', true, 'demo-1');
insert into storage.objects (bucket_id, name) values
  ('expedientes', 'bbbbbbbb-0000-0000-0000-000000000001/11111111-1111-1111-1111-111111111111.pdf');

-- Biblioteca: una fuente para consultores y otra solo admin, ambas indexadas.
insert into public.sources (id, titulo, referencia, grupo, licencia, nivel_acceso, estado) values
  ('5a000000-0000-0000-0000-000000000001', 'Fuente demo consultores', 'demo', 'aportada', 'demo', 'consultores', 'indexado'),
  ('5a000000-0000-0000-0000-000000000002', 'Fuente demo admin', 'demo', 'aportada', 'demo', 'admin', 'indexado');
insert into public.source_versions (id, source_id, sha256, metodo_extraccion) values
  ('5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', repeat('a', 64), 'demo'),
  ('5b000000-0000-0000-0000-000000000002', '5a000000-0000-0000-0000-000000000002', repeat('b', 64), 'demo');
insert into public.chunks (source_version_id, texto, nivel_acceso) values
  ('5b000000-0000-0000-0000-000000000001', 'La numerología pitagórica asigna valores a las letras.', 'consultores'),
  ('5b000000-0000-0000-0000-000000000002', 'Nota interna de numerología pitagórica para administración.', 'admin');

-- ---------------------------------------------------------------- consultora A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

select results_eq(
  'select id from public.case_files',
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'consultora A solo lista su expediente'
);
select is((select count(*) from public.birth_profiles), 1::bigint, 'consultora A solo abre su perfil de nacimiento');
select is_empty($$ update public.birth_profiles set birth_name = 'X' where case_file_id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1 $$, 'consultora A no modifica el expediente B');
select is_empty($$ delete from public.case_files where id = 'bbbbbbbb-0000-0000-0000-000000000001' returning 1 $$, 'consultora A no borra el expediente B');
select throws_ok(
  $$ insert into public.readings (case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado, created_by)
     values ('bbbbbbbb-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'consultora A no crea lecturas en el expediente B'
);
select lives_ok(
  $$ insert into public.readings (case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}', '00000000-0000-0000-0000-0000000000a1') $$,
  'consultora A crea lecturas en su expediente'
);
select throws_ok(
  $$ insert into public.user_roles (user_id, role_id, granted_by) values ('00000000-0000-0000-0000-0000000000a1', 'admin', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'consultora A no se autoasigna el rol admin'
);
select is_empty(
  $$ update public.user_profiles set status = 'activo' where user_id = '00000000-0000-0000-0000-0000000000d1' returning 1 $$,
  'consultora A no reactiva cuentas'
);
select throws_ok(
  $$ insert into public.case_file_grants (case_file_id, user_id, permissions, granted_by)
     values ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '{listar}', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null,
  'consultora A no se asigna expedientes ajenos'
);
select throws_ok(
  $$ insert into public.audit_log (accion, recurso_tipo) values ('falsa', 'x') $$,
  '42501', null,
  'consultora A no escribe en la auditoría'
);
select is((select count(*) from public.audit_log), 0::bigint, 'consultora A no lee la auditoría');
select is((select count(*) from storage.objects where bucket_id = 'expedientes'), 0::bigint, 'consultora A no ve archivos del expediente B');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('expedientes', 'bbbbbbbb-0000-0000-0000-000000000001/22222222-2222-2222-2222-222222222222.pdf') $$,
  '42501', null,
  'consultora A no carga archivos al expediente B'
);
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values ('expedientes', 'aaaaaaaa-0000-0000-0000-000000000001/33333333-3333-3333-3333-333333333333.pdf') $$,
  'consultora A carga archivos a su expediente'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('biblioteca-originales', 'libro.pdf') $$,
  '42501', null,
  'consultora A no carga directamente a la biblioteca'
);
select throws_ok(
  $$ insert into public.case_files (display_label, created_by) values ('Suplantación', '00000000-0000-0000-0000-0000000000b1') $$,
  '42501', null,
  'no se crean expedientes a nombre de otra persona'
);
select is((select count(*) from public.chunks), 0::bigint, 'los fragmentos no se leen directamente');
select results_eq(
  $$ select titulo from public.hybrid_search('numerología pitagórica', null) $$,
  $$ values ('Fuente demo consultores'::text) $$,
  'la búsqueda de la consultora excluye fuentes de nivel admin'
);
select throws_ok(
  $$ select public.completar_alta_admin('00000000-0000-0000-0000-0000000000a1', 'X') $$,
  '42501', null,
  'un usuario no puede invocar el alta inicial'
);

-- ---------------------------------------------------------------- cliente
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select results_eq(
  'select id from public.case_files',
  $$ values ('aaaaaaaa-0000-0000-0000-000000000001'::uuid) $$,
  'la persona cliente solo ve su expediente'
);
select is((select birth_name from public.birth_profiles), 'Ana María Núñez', 'la persona cliente abre su perfil');
select is_empty($$ update public.birth_profiles set birth_name = 'X' returning 1 $$, 'la persona cliente no modifica su perfil');
select is((select count(*) from public.hybrid_search('numerología pitagórica', null)), 0::bigint, 'la persona cliente no ve fuentes de consultores');

-- ---------------------------------------------------------------- consultor B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.case_files), 1::bigint, 'consultor B solo ve su expediente');
select is((select count(*) from storage.objects where bucket_id = 'expedientes'), 1::bigint, 'consultor B ve los archivos de su expediente');

-- ---------------------------------------------------------------- administración
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
select is((select count(*) from public.case_files), 0::bigint, 'administración sin verificación en dos pasos no ve expedientes');
select is((select count(*) from public.user_profiles), 1::bigint, 'administración sin verificación en dos pasos solo ve su propio perfil');
select is((public.mi_acceso() ->> 'aal2')::boolean, false, 'mi_acceso informa que falta la verificación en dos pasos');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select is((public.mi_acceso() -> 'roles'), '["admin"]'::jsonb, 'mi_acceso devuelve los roles propios');
select is((select count(*) from public.case_files), 3::bigint, 'administración ve todos los expedientes');
select throws_ok(
  $$ insert into public.case_file_grants (case_file_id, user_id, permissions, granted_by)
     values ('bbbbbbbb-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', '{listar}', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null,
  'administración no se asigna a sí misma'
);
select lives_ok(
  $$ insert into public.case_file_grants (case_file_id, user_id, permissions, granted_by, expires_at)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', '{listar,abrir_descargar}', '00000000-0000-0000-0000-00000000000a', now() - interval '1 minute') $$,
  'administración asigna el expediente A a consultor B (vencido)'
);
select ok((select count(*) from public.audit_log where recurso_tipo = 'case_file_grants') = 1, 'la asignación queda en la auditoría');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.case_files), 1::bigint, 'una asignación vencida no da acceso');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
update public.case_file_grants set expires_at = now() + interval '1 day'
  where case_file_id = 'aaaaaaaa-0000-0000-0000-000000000001' and user_id = '00000000-0000-0000-0000-0000000000b1';

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select is((select count(*) from public.case_files), 2::bigint, 'una asignación vigente da acceso de lectura');
select is_empty($$ update public.birth_profiles set birth_name = 'X' where case_file_id = 'aaaaaaaa-0000-0000-0000-000000000001' returning 1 $$, 'la asignación de solo lectura no permite modificar');

-- ---------------------------------------------------------------- suspendida y sin rol
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select is((select count(*) from public.case_files), 0::bigint, 'una cuenta suspendida no ve ni sus propios expedientes');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.case_files (display_label, created_by) values ('Sin permiso', '00000000-0000-0000-0000-0000000000e1') $$,
  '42501', null,
  'un usuario sin rol no crea expedientes'
);

-- ---------------------------------------------------------------- anónimo
set local role anon;
select throws_ok('select * from public.case_files', '42501', null, 'el rol anónimo no lee expedientes');

select * from finish();
rollback;
