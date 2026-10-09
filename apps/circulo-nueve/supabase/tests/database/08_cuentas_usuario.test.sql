-- Cuentas v2: nombre de usuario, cambio de contraseña obligatorio, asistentes
-- con permisos individuales y clientes de solo lectura.
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

insert into auth.users (id, email, aud, role, encrypted_password) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@usuarios.circulo-nueve.invalid', 'authenticated', 'authenticated', 'hash-admin'),
  ('00000000-0000-0000-0000-0000000000a1', 'asistente@usuarios.circulo-nueve.invalid', 'authenticated', 'authenticated', 'hash-inicial'),
  ('00000000-0000-0000-0000-0000000000a2', 'asistente2@usuarios.circulo-nueve.invalid', 'authenticated', 'authenticated', 'hash-x'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@usuarios.circulo-nueve.invalid', 'authenticated', 'authenticated', 'hash-c');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Jesús', 'Jesus');
select is((select username from public.user_profiles where user_id = '00000000-0000-0000-0000-00000000000a'), 'jesus', 'el alta guarda el usuario en minúsculas');

select throws_ok(
  $$ insert into public.user_profiles (user_id, display_name, username) values ('00000000-0000-0000-0000-0000000000a2', 'X', 'Con Espacios') $$,
  '23514', null, 'el nombre de usuario tiene un formato limitado'
);
insert into public.user_profiles (user_id, display_name, username) values
  ('00000000-0000-0000-0000-0000000000a1', 'Asistente Uno', 'asistente.uno'),
  ('00000000-0000-0000-0000-0000000000a2', 'Asistente Dos', 'asistente.dos'),
  ('00000000-0000-0000-0000-0000000000c1', 'Cliente Demo', 'cliente.demo');
select throws_ok(
  $$ update public.user_profiles set username = 'asistente.uno' where user_id = '00000000-0000-0000-0000-0000000000a2' $$,
  '23505', null, 'el nombre de usuario es único'
);
insert into public.user_roles (user_id, role_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'consultor'),
  ('00000000-0000-0000-0000-0000000000a2', 'consultor'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente');
select is(public.correo_de_usuario(' Asistente.Uno '), 'asistente@usuarios.circulo-nueve.invalid', 'el servidor resuelve el correo interno por usuario');

insert into public.case_files (id, display_label, created_by, client_user_id) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Expediente del cliente (demo)', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000c1');
insert into public.readings (id, case_file_id, sistema, motor, motor_version, reglas_version, entradas_hash, resultado_calculado)
  values ('eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'numerologia', 'm', '1', 'r', 'h', '{}');
insert into public.sources (id, titulo, referencia, grupo, licencia, nivel_acceso, estado) values
  ('5a000000-0000-0000-0000-000000000001', 'Fuente pública (DEMO)', 'demo', 'aportada', 'propia', 'publico', 'indexado');
insert into public.source_versions (id, source_id, sha256, metodo_extraccion, es_vigente) values
  ('5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', repeat('d', 64), 'demo', true);
insert into public.chunks (source_version_id, texto, nivel_acceso) values
  ('5b000000-0000-0000-0000-000000000001', 'El camino de vida en una fuente pública ficticia.', 'publico');

-- ---------------------------------------------------------------- asistente sin permisos
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((public.mi_acceso() -> 'permisos'), '[]'::jsonb, 'el rol de asistente no trae permisos por sí mismo');
select throws_ok(
  $$ insert into public.case_files (display_label, created_by) values ('X', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'un asistente sin permisos no crea expedientes'
);
select is((select count(*) from public.case_files), 0::bigint, 'un asistente sin asignaciones no ve expedientes');
select is((select count(*) from public.hybrid_search('camino de vida', null)), 1::bigint, 'un asistente consulta la biblioteca pública');
select throws_ok(
  $$ insert into public.user_permissions (user_id, permission_id, alcance, granted_by) values ('00000000-0000-0000-0000-0000000000a1', 'cargar', 'propio', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'un asistente no se asigna permisos'
);
select throws_ok($$ select public.correo_de_usuario('jesus') $$, '42501', null, 'un usuario no resuelve correos internos');
select throws_ok($$ select public.exigir_cambio_contrasena('00000000-0000-0000-0000-0000000000a2') $$, '42501', null, 'un usuario no puede exigir cambios de contraseña');

-- ---------------------------------------------------------------- la administración asigna permisos
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.user_permissions (user_id, permission_id, alcance, granted_by)
     select '00000000-0000-0000-0000-0000000000a1', p, 'propio', '00000000-0000-0000-0000-00000000000a'
     from unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar']) p $$,
  'la administración asigna «expedientes propios» a un asistente'
);
select throws_ok(
  $$ insert into public.user_permissions (user_id, permission_id, alcance, granted_by) values ('00000000-0000-0000-0000-00000000000a', 'cargar', 'global', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'la administración no se asigna permisos a sí misma'
);

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.case_files (id, display_label, created_by) values ('aaaaaaaa-0000-0000-0000-0000000000a1', 'Propio (demo)', '00000000-0000-0000-0000-0000000000a1') $$,
  'con el permiso asignado, el asistente crea su expediente'
);
select is((select count(*) from public.case_files), 1::bigint, 'el asistente solo ve sus expedientes, no los de otros');

-- ---------------------------------------------------------------- cliente: solo lectura de lo suyo
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*) from public.readings), 1::bigint, 'la persona cliente lee sus lecturas');
select throws_ok(
  $$ insert into public.documents (case_file_id, reading_id, storage_path, version_plantilla, created_by)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'eeeeeeee-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001/x.pdf', 'v', '00000000-0000-0000-0000-0000000000c1') $$,
  '42501', null, 'la persona cliente no genera documentos'
);
select is((select count(*) from public.hybrid_search('camino de vida', null)), 0::bigint, 'la persona cliente no consulta la biblioteca');

-- ---------------------------------------------------------------- cambio de contraseña obligatorio
reset role;
select public.exigir_cambio_contrasena('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.case_files), 0::bigint, 'con cambio de contraseña pendiente no se ve nada');
select throws_ok($$ select public.confirmar_cambio_contrasena() $$, 'P0001', 'La contraseña no cambió', 'no se libera sin cambiar la contraseña');
reset role;
update auth.users set encrypted_password = 'hash-nuevo' where id = '00000000-0000-0000-0000-0000000000a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok($$ select public.confirmar_cambio_contrasena() $$, 'tras cambiarla, se libera');
select is((select count(*) from public.case_files), 1::bigint, 'y vuelve a ver sus expedientes');

select * from finish();
rollback;
