-- Círculo Nueve · Biblioteca RAG: centro de carga, ingesta web, revisión,
-- versiones, embeddings multilingües (384 dims, multilingual-e5-small) y
-- búsqueda híbrida con permisos y fragmentos revisados.

-- ---------------------------------------------------------------------------
-- Fuentes
alter table public.sources
  add column origen text not null default 'archivo' check (origen in ('archivo', 'web')),
  add column url text,
  add column formato text,
  add column fecha_publicacion text,
  add column notas_derechos text,
  add column es_demo boolean not null default false,
  add column motivo_fallo text,
  add column created_by uuid references auth.users (id) on delete set null;

create policy "administración de fuentes crea fuentes"
  on public.sources for insert to authenticated
  with check ((select public.has_perm('admin_fuentes')) and created_by = (select auth.uid()));
create policy "administración de fuentes edita fuentes"
  on public.sources for update to authenticated
  using ((select public.has_perm('admin_fuentes')))
  with check ((select public.has_perm('admin_fuentes')));

create trigger auditar_sources after insert or update or delete on public.sources
  for each row execute function public.auditar_cambio();

-- ---------------------------------------------------------------------------
-- Versiones
alter table public.source_versions
  add column original_path text,
  add column markdown_path text,
  add column num_fragmentos integer not null default 0,
  add column advertencias jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- Trabajos de ingesta
alter table public.ingestion_jobs
  add column etapa text not null default 'extraer' check (etapa in ('extraer', 'indexar')),
  add column source_version_id uuid references public.source_versions (id) on delete cascade,
  add column storage_path text,
  add column url text,
  add column iniciado_at timestamptz,
  add column terminado_at timestamptz,
  add column created_by uuid references auth.users (id) on delete set null;
create index ingestion_jobs_pendientes_idx on public.ingestion_jobs (created_at) where estado = 'pendiente';

create policy "administración de fuentes crea trabajos"
  on public.ingestion_jobs for insert to authenticated
  with check ((select public.has_perm('admin_fuentes')) and created_by = (select auth.uid()) and estado = 'pendiente');

-- Toma un trabajo pendiente de forma atómica (varios workers no procesan el mismo).
create function public.tomar_trabajo_ingesta()
returns setof public.ingestion_jobs
language sql volatile security definer set search_path = ''
as $$
  update public.ingestion_jobs j
  set estado = 'procesando', iniciado_at = now(), intentos = j.intentos + 1
  where j.id = (
    select id from public.ingestion_jobs
    where estado = 'pendiente'
    order by created_at
    for update skip locked
    limit 1
  )
  returning j.*;
$$;
revoke execute on function public.tomar_trabajo_ingesta() from public, anon, authenticated;
grant execute on function public.tomar_trabajo_ingesta() to service_role;

-- ---------------------------------------------------------------------------
-- Fragmentos: 384 dimensiones, revisión y marcas de posible inyección.
drop index public.chunks_embedding_idx;
alter table public.chunks
  alter column embedding type extensions.vector(384),
  add column orden integer not null default 0,
  add column excluido boolean not null default false,
  add column sospechoso boolean not null default false,
  add column motivo_sospecha text;
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index chunks_version_orden_idx on public.chunks (source_version_id, orden);

create policy "administración de fuentes revisa fragmentos"
  on public.chunks for select to authenticated
  using ((select public.has_perm('admin_fuentes')));
create policy "administración de fuentes excluye fragmentos"
  on public.chunks for update to authenticated
  using ((select public.has_perm('admin_fuentes')))
  with check ((select public.has_perm('admin_fuentes')));

-- Solo se puede cambiar `excluido` desde la revisión; el texto y los vectores los escribe el worker.
create function public.proteger_fragmento()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (
    new.texto is distinct from old.texto
    or new.embedding::text is distinct from old.embedding::text
    or new.localizador is distinct from old.localizador
    or new.nivel_acceso is distinct from old.nivel_acceso
    or new.source_version_id is distinct from old.source_version_id
  ) then
    raise exception 'Solo se puede excluir o incluir un fragmento' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger chunks_proteger before update on public.chunks
  for each row execute function public.proteger_fragmento();

-- ---------------------------------------------------------------------------
-- Búsqueda híbrida (texto en español sin acentos + vector) con RRF.
drop function public.hybrid_search(text, extensions.vector, integer, text, text, text, real, real, integer);

create function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(384),
  match_count integer default 8,
  filtro_tradicion text default null,
  filtro_idioma text default null,
  filtro_grupo text default null,
  full_text_weight real default 1,
  semantic_weight real default 1,
  rrf_k integer default 50,
  -- Similitud coseno mínima para la parte semántica. Calibrada para
  -- multilingual-e5-small, que comprime el rango (ajeno ≈ 0.76–0.82; relevante ≥ 0.83).
  min_similitud real default 0.85
)
returns table (
  chunk_id uuid,
  source_id uuid,
  titulo text,
  autor text,
  referencia text,
  edicion text,
  fecha_consulta date,
  grupo text,
  es_demo boolean,
  texto text,
  localizador jsonb,
  jerarquia text[],
  sospechoso boolean,
  ocr_confianza real,
  puntaje double precision
)
language sql stable security definer set search_path = ''
as $$
  with niveles as (select public.niveles_acceso_permitidos() as n),
  permitidos as (
    select c.*, s.id as s_id, s.titulo as s_titulo, s.autor as s_autor, s.referencia as s_referencia,
           s.edicion as s_edicion, s.fecha_consulta as s_fecha, s.grupo as s_grupo, s.es_demo as s_demo
    from public.chunks c
    join public.source_versions v on v.id = c.source_version_id and v.es_vigente
    join public.sources s on s.id = v.source_id and s.estado = 'indexado'
    cross join niveles
    where not c.excluido
      and c.nivel_acceso = any (niveles.n)
      and s.nivel_acceso = any (niveles.n)
      and (filtro_tradicion is null or c.tradicion = filtro_tradicion)
      and (filtro_idioma is null or c.idioma = filtro_idioma)
      and (filtro_grupo is null or s.grupo = filtro_grupo)
  ),
  -- OR de los lexemas de la pregunta (sin palabras vacías): las preguntas naturales
  -- no repiten todas sus palabras en el pasaje; el rango ordena por relevancia.
  lexemas as (
    select pg_catalog.tsvector_to_array(pg_catalog.to_tsvector('spanish', public.unaccent_inmutable(coalesce(query_text, '')))) as l
  ),
  consulta as (
    select case when pg_catalog.cardinality(l) = 0 then null
      else pg_catalog.to_tsquery('spanish', pg_catalog.array_to_string(array(select pg_catalog.quote_literal(x) from unnest(l) as x), ' | '))
    end as q
    from lexemas
  ),
  texto_completo as (
    select p.id, row_number() over (order by pg_catalog.ts_rank_cd(p.fts, consulta.q) desc) as rango
    from permitidos p, consulta
    where p.fts @@ consulta.q
    limit least(match_count, 30) * 2
  ),
  semantica as (
    select id, row_number() over (order by embedding operator(extensions.<=>) query_embedding) as rango
    from permitidos
    where embedding is not null and query_embedding is not null
      and 1 - (embedding operator(extensions.<=>) query_embedding) >= min_similitud
    order by embedding operator(extensions.<=>) query_embedding
    limit least(match_count, 30) * 2
  )
  select p.id, p.s_id, p.s_titulo, p.s_autor, p.s_referencia, p.s_edicion, p.s_fecha, p.s_grupo, p.s_demo,
    p.texto, p.localizador, p.jerarquia, p.sospechoso, p.ocr_confianza,
    coalesce(1.0 / (rrf_k + t.rango), 0.0) * full_text_weight
      + coalesce(1.0 / (rrf_k + se.rango), 0.0) * semantic_weight as puntaje
  from texto_completo t
  full outer join semantica se on se.id = t.id
  join permitidos p on p.id = coalesce(t.id, se.id)
  order by puntaje desc
  limit least(match_count, 30);
$$;
revoke execute on function public.hybrid_search(text, extensions.vector, integer, text, text, text, real, real, integer, real) from public, anon;
grant execute on function public.hybrid_search(text, extensions.vector, integer, text, text, text, real, real, integer, real) to authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
