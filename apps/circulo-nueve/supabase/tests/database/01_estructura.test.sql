-- Estructura de seguridad: RLS en todo public, buckets privados, anon sin acceso,
-- funciones security definer con search_path fijo, pgvector instalado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

select is(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0::bigint,
  'todas las tablas de public tienen RLS activado'
);

select ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r') >= 20,
  'existen las tablas del esquema'
);

select is(
  (select count(*) from information_schema.role_table_grants
   where table_schema = 'public' and grantee = 'anon'),
  0::bigint,
  'el rol anónimo no tiene privilegios sobre tablas de public'
);

select is(
  (select count(*) from storage.buckets where id in ('cuarentena', 'biblioteca-originales', 'biblioteca-derivados', 'expedientes') and not public),
  4::bigint,
  'los cuatro buckets existen y son privados'
);

select is(
  (select count(*) from storage.buckets where public),
  0::bigint,
  'no hay buckets públicos'
);

select is(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not coalesce(p.proconfig @> array['search_path=""'], false)),
  0::bigint,
  'toda función security definer fija search_path vacío'
);

select ok(
  exists (select 1 from pg_extension where extname = 'vector'),
  'pgvector está instalado'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'public' and tablename = 'chunks' and indexdef ilike '%hnsw%'),
  'los fragmentos tienen índice HNSW'
);

select * from finish();
rollback;
