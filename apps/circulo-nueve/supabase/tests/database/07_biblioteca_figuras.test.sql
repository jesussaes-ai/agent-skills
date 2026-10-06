-- Figuras: solo se ven si su fragmento es consultable; la revisión solo corrige la descripción.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a1', 'consultora@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'cliente@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.user_profiles (user_id, display_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'Consultora'), ('00000000-0000-0000-0000-0000000000c1', 'Cliente');
insert into public.user_roles (user_id, role_id) values
  ('00000000-0000-0000-0000-0000000000a1', 'consultor'), ('00000000-0000-0000-0000-0000000000c1', 'cliente');

insert into public.sources (id, titulo, referencia, grupo, licencia, nivel_acceso, estado) values
  ('5a000000-0000-0000-0000-000000000001', 'Atlas ficticio (DEMO)', 'demo', 'aportada', 'propia', 'consultores', 'indexado');
insert into public.source_versions (id, source_id, sha256, metodo_extraccion, es_vigente) values
  ('5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001', repeat('c', 64), 'demo', true);
insert into public.chunks (id, source_version_id, texto, nivel_acceso) values
  ('5c000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', '[Figura 1] Diagrama ficticio.', 'consultores');
insert into public.visual_assets (id, source_version_id, storage_path, pagina, leyenda, descripcion_generada, descripcion_modelo, descripcion_fecha) values
  ('5e000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', '5a000000-0000-0000-0000-000000000001/5b000000-0000-0000-0000-000000000001/figura-1.png', '1', 'Figura 1. Diagrama ficticio', 'Descripción automática', 'plantilla-leyenda-ocr-v1', now());
insert into public.chunk_visual_links values ('5c000000-0000-0000-0000-000000000001', '5e000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*) from public.figuras_de_fragmentos(array['5c000000-0000-0000-0000-000000000001'::uuid])), 1::bigint, 'la consultora ve la figura de un fragmento consultable');
select isnt(public.ruta_figura_autorizada('5e000000-0000-0000-0000-000000000001'), null, 'la consultora obtiene la ruta de la figura');
select is((select count(*) from public.visual_assets), 0::bigint, 'la consultora no lee la tabla de figuras directamente');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is(public.ruta_figura_autorizada('5e000000-0000-0000-0000-000000000001'), null, 'una cuenta sin el nivel de acceso no obtiene la figura');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$ update public.visual_assets set correccion_admin = 'Diagrama corregido a mano' where id = '5e000000-0000-0000-0000-000000000001' $$,
  'administración corrige la descripción'
);
select throws_ok(
  $$ update public.visual_assets set descripcion_generada = 'alterada' where id = '5e000000-0000-0000-0000-000000000001' $$,
  '42501', null, 'la descripción generada no se puede reescribir'
);

reset role;
select is((select file_size_limit from storage.buckets where id = 'cuarentena'), 52428800::bigint, 'la cuarentena admite hasta 50 MB');

select * from finish();
rollback;
