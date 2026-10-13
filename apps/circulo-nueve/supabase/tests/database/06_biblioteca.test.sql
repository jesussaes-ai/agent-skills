-- Biblioteca: administración de fuentes, revisión de fragmentos, cola de
-- trabajos y búsqueda que excluye lo no aprobado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'consultora@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.user_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000000a1', 'Consultora');
insert into public.user_roles (user_id, role_id) values ('00000000-0000-0000-0000-0000000000a1', 'consultor');
insert into public.user_permissions (user_id, permission_id, alcance)
  select ur.user_id, p, 'propio' from public.user_roles ur,
    unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar', 'borrar', 'compartir']) as p
  where ur.role_id = 'consultor';

insert into public.sources (id, titulo, referencia, grupo, licencia, nivel_acceso, estado, es_demo) values
  ('5a000000-0000-0000-0000-000000000001', 'Manual ficticio (DEMO)', 'demo', 'aportada', 'propia', 'consultores', 'indexado', true);
insert into public.source_versions (id, source_id, sha256, metodo_extraccion, es_vigente) values
  ('5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', repeat('a', 64), 'demo', true);
insert into public.chunks (id, source_version_id, texto, nivel_acceso, excluido) values
  ('5c000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', 'El camino de vida en el manual ficticio.', 'consultores', false),
  ('5c000000-0000-0000-0000-000000000002', '5b000000-0000-0000-0000-000000000001', 'El camino de vida excluido en revisión.', 'consultores', true);
insert into public.ingestion_jobs (id, source_id, estado) values
  ('5d000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', 'pendiente');

-- ---------------------------------------------------------------- consultora
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.sources (titulo, referencia, grupo, licencia, created_by) values ('X', 'x', 'aportada', 'x', '00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'una consultora no crea fuentes'
);
select is((select count(*) from public.sources), 0::bigint, 'una consultora no ve el catálogo');
select is((select count(*) from public.hybrid_search('camino de vida', null)), 1::bigint, 'la búsqueda no devuelve fragmentos excluidos');
select throws_ok($$ select * from public.tomar_trabajo_ingesta() $$, '42501', null, 'una consultora no toma trabajos de ingesta');

-- ---------------------------------------------------------------- administración (aal2)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ insert into public.sources (titulo, referencia, grupo, licencia, created_by) values ('Nueva (DEMO)', 'demo', 'complementaria', 'propia', '00000000-0000-0000-0000-00000000000a') $$,
  'administración crea fuentes'
);
select is((select count(*) from public.chunks), 2::bigint, 'administración revisa todos los fragmentos');
select lives_ok(
  $$ update public.chunks set excluido = true where id = '5c000000-0000-0000-0000-000000000001' $$,
  'administración excluye un fragmento'
);
select throws_ok(
  $$ update public.chunks set texto = 'alterado' where id = '5c000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'en la revisión no se puede alterar el texto de un fragmento'
);
select is((select count(*) from public.hybrid_search('camino de vida', null)), 0::bigint, 'excluidos todos, la búsqueda no devuelve nada');
select throws_ok(
  $$ insert into public.ingestion_jobs (source_id, estado, created_by) values ('5a000000-0000-0000-0000-000000000001', 'indexado', '00000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'los trabajos se crean siempre pendientes'
);

-- ---------------------------------------------------------------- worker (service role)
reset role;
select is((select estado from public.tomar_trabajo_ingesta()), 'procesando', 'el worker toma el trabajo y lo marca procesando');
select is((select count(*) from public.tomar_trabajo_ingesta()), 0::bigint, 'el mismo trabajo no se toma dos veces');

select * from finish();
rollback;
