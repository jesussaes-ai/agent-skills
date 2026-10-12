-- Cola de ingesta en producción: la app (Vercel) solo toma trabajos ligeros, cede los que
-- necesitan OCR al worker y los trabajos interrumpidos vuelven a la cola o fallan al tercer intento.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000b0', 'admin-cola@demo.invalid', 'authenticated', 'authenticated');
insert into public.user_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000000b0', 'Admin cola');
insert into public.user_roles (user_id, role_id) values ('00000000-0000-0000-0000-0000000000b0', 'admin');
insert into public.sources (id, titulo, referencia, grupo, licencia, created_by) values
  ('5b000000-0000-0000-0000-000000000001', 'Escaneo (DEMO)', 'demo', 'aportada', 'dominio público', '00000000-0000-0000-0000-0000000000b0'),
  ('5b000000-0000-0000-0000-000000000002', 'Libro (DEMO)', 'demo', 'aportada', 'dominio público', '00000000-0000-0000-0000-0000000000b0'),
  ('5b000000-0000-0000-0000-000000000003', 'Interrumpido (DEMO)', 'demo', 'aportada', 'dominio público', '00000000-0000-0000-0000-0000000000b0');
insert into public.ingestion_jobs (id, source_id, nombre_archivo, storage_path, created_at, created_by) values
  ('b0000000-0000-0000-0000-000000000001', '5b000000-0000-0000-0000-000000000001', 'pagina.png', 'x/1.png', now() - interval '3 minutes', '00000000-0000-0000-0000-0000000000b0'),
  ('b0000000-0000-0000-0000-000000000002', '5b000000-0000-0000-0000-000000000002', 'libro.pdf', 'x/2.pdf', now() - interval '2 minutes', '00000000-0000-0000-0000-0000000000b0');

select is((select count(*)::integer from public.ingestion_jobs where id::text like 'b0000000%'), 2, 'dos trabajos en la cola');
select is((select id from public.tomar_trabajo_ingesta(true)), 'b0000000-0000-0000-0000-000000000002'::uuid, 'la app salta la imagen y toma el PDF');
select lives_ok($$ select public.ceder_trabajo_al_worker('b0000000-0000-0000-0000-000000000002') $$, 'la app cede el PDF escaneado al worker');
select is(
  (select estado || ':' || requiere_worker::text from public.ingestion_jobs where id = 'b0000000-0000-0000-0000-000000000002'),
  'pendiente:true', 'el PDF cedido vuelve a la cola marcado para el worker'
);
select is((select count(*)::integer from public.tomar_trabajo_ingesta(true)), 0, 'la app ya no toma nada que necesite OCR');
select is((select id from public.tomar_trabajo_ingesta()), 'b0000000-0000-0000-0000-000000000001'::uuid, 'el worker toma la imagen');

-- Trabajo que la app tomó y se cortó por tiempo hace 20 minutos.
insert into public.ingestion_jobs (id, source_id, nombre_archivo, estado, intentos, tomado_ligero, iniciado_at, created_at, created_by) values
  ('b0000000-0000-0000-0000-000000000003', '5b000000-0000-0000-0000-000000000003', 'otro.epub', 'procesando', 1, true, now() - interval '20 minutes', now() - interval '30 minutes', '00000000-0000-0000-0000-0000000000b0');
select is((select id from public.tomar_trabajo_ingesta()), 'b0000000-0000-0000-0000-000000000003'::uuid, 'un trabajo interrumpido vuelve a tomarse');

update public.ingestion_jobs set intentos = 3, tomado_ligero = true, iniciado_at = now() - interval '20 minutes' where id = 'b0000000-0000-0000-0000-000000000003';
select is((select id from public.tomar_trabajo_ingesta()), 'b0000000-0000-0000-0000-000000000002'::uuid, 'al tercer corte no se reintenta: sigue el siguiente');
select is(
  (select j.estado || ':' || s.estado from public.ingestion_jobs j join public.sources s on s.id = j.source_id where j.id = 'b0000000-0000-0000-0000-000000000003'),
  'fallido:fallido', 'el trabajo y la fuente quedan fallidos con el motivo'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b0","role":"authenticated","aal":"aal2"}', true);
select throws_ok($$ select public.ceder_trabajo_al_worker('b0000000-0000-0000-0000-000000000001') $$, '42501', null, 'ni la administración cede trabajos desde el navegador');

select * from finish();
rollback;
