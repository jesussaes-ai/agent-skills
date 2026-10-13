-- Círculo Nueve · Biblioteca RAG (libros y webs autorizados). Separada de la
-- ayuda de la app. Escritura solo desde el worker (service role); lectura solo
-- mediante hybrid_search, que filtra por nivel de acceso dentro de la función.

create function public.unaccent_inmutable(texto text)
returns text
language sql immutable parallel safe strict set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto);
$$;

create table public.sources (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  autor text,
  referencia text not null,
  edicion text,
  fecha_consulta date,
  idioma text not null default 'es',
  tradicion text,
  grupo text not null check (grupo in ('aportada', 'complementaria')),
  licencia text not null,
  nivel_acceso text not null default 'consultores' check (nivel_acceso in ('publico', 'consultores', 'admin')),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'requiere_revision', 'indexado', 'fallido', 'retirado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sources enable row level security;

create table public.source_versions (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources (id) on delete cascade,
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  metodo_extraccion text not null,
  ingestado_at timestamptz not null default now(),
  diff_resumen text,
  es_vigente boolean not null default true,
  unique (source_id, sha256)
);
create unique index source_versions_vigente_idx on public.source_versions (source_id) where es_vigente;
alter table public.source_versions enable row level security;

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.sources (id) on delete cascade,
  nombre_archivo text,
  formato_detectado text,
  tamano_bytes bigint check (tamano_bytes >= 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'procesando', 'requiere_revision', 'indexado', 'fallido', 'retirado')),
  antivirus text check (antivirus in ('pendiente', 'limpio', 'rechazado')),
  errores jsonb not null default '[]'::jsonb,
  elementos_extraidos integer not null default 0,
  intentos integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ingestion_jobs enable row level security;

-- Dimensión 1024 (p. ej. bge-m3). Cambiar de modelo implica columna/índice nuevos y reindexar.
create table public.chunks (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.source_versions (id) on delete cascade,
  texto text not null,
  localizador jsonb not null default '{}'::jsonb,
  jerarquia text[] not null default '{}',
  ocr_confianza real check (ocr_confianza between 0 and 1),
  idioma text not null default 'es',
  tradicion text,
  nivel_acceso text not null check (nivel_acceso in ('publico', 'consultores', 'admin')),
  fts tsvector generated always as (pg_catalog.to_tsvector('spanish'::regconfig, public.unaccent_inmutable(texto))) stored,
  embedding extensions.vector(1024),
  embedding_model text,
  created_at timestamptz not null default now(),
  check ((embedding is null) = (embedding_model is null))
);
create index chunks_fts_idx on public.chunks using gin (fts);
create index chunks_embedding_idx on public.chunks using hnsw (embedding extensions.vector_cosine_ops);
create index chunks_source_version_idx on public.chunks (source_version_id);
alter table public.chunks enable row level security;

create table public.visual_assets (
  id uuid primary key default gen_random_uuid(),
  source_version_id uuid not null references public.source_versions (id) on delete cascade,
  storage_path text not null unique,
  pagina text,
  leyenda text,
  ocr text,
  descripcion_generada text,
  descripcion_modelo text,
  descripcion_fecha timestamptz,
  correccion_admin text,
  check ((descripcion_generada is null) or (descripcion_modelo is not null and descripcion_fecha is not null))
);
alter table public.visual_assets enable row level security;

create table public.chunk_visual_links (
  chunk_id uuid not null references public.chunks (id) on delete cascade,
  visual_asset_id uuid not null references public.visual_assets (id) on delete cascade,
  primary key (chunk_id, visual_asset_id)
);
alter table public.chunk_visual_links enable row level security;

-- El catálogo (sin fragmentos) lo ven quienes administran fuentes.
create policy "administración de fuentes ve el catálogo"
  on public.sources for select to authenticated
  using ((select public.has_perm('admin_fuentes')));
create policy "administración de fuentes ve versiones"
  on public.source_versions for select to authenticated
  using ((select public.has_perm('admin_fuentes')));
create policy "administración de fuentes ve trabajos de ingesta"
  on public.ingestion_jobs for select to authenticated
  using ((select public.has_perm('admin_fuentes')));

create trigger sources_updated_at before update on public.sources
  for each row execute function public.tocar_updated_at();
create trigger ingestion_jobs_updated_at before update on public.ingestion_jobs
  for each row execute function public.tocar_updated_at();

create function public.niveles_acceso_permitidos()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case
    when not public.es_usuario_activo() then array[]::text[]
    when public.has_perm('admin_fuentes') then array['publico', 'consultores', 'admin']
    when public.has_perm('cargar') then array['publico', 'consultores']
    else array['publico']
  end;
$$;
revoke execute on function public.niveles_acceso_permitidos() from public, anon;
grant execute on function public.niveles_acceso_permitidos() to authenticated, service_role;

-- Búsqueda híbrida (texto completo + vector) fusionada con Reciprocal Rank Fusion.
-- Solo fuentes indexadas, versión vigente y niveles de acceso permitidos.
create function public.hybrid_search(
  query_text text,
  query_embedding extensions.vector(1024),
  match_count integer default 8,
  filtro_tradicion text default null,
  filtro_idioma text default null,
  filtro_grupo text default null,
  full_text_weight real default 1,
  semantic_weight real default 1,
  rrf_k integer default 50
)
returns table (
  chunk_id uuid,
  source_id uuid,
  titulo text,
  grupo text,
  texto text,
  localizador jsonb,
  puntaje double precision
)
language sql stable security definer set search_path = ''
as $$
  with permitidos as (
    select c.*, s.id as s_id, s.titulo as s_titulo, s.grupo as s_grupo
    from public.chunks c
    join public.source_versions v on v.id = c.source_version_id and v.es_vigente
    join public.sources s on s.id = v.source_id and s.estado = 'indexado'
    where c.nivel_acceso = any (public.niveles_acceso_permitidos())
      and s.nivel_acceso = any (public.niveles_acceso_permitidos())
      and (filtro_tradicion is null or c.tradicion = filtro_tradicion)
      and (filtro_idioma is null or c.idioma = filtro_idioma)
      and (filtro_grupo is null or s.grupo = filtro_grupo)
  ),
  texto_completo as (
    select id, row_number() over (
      order by pg_catalog.ts_rank_cd(fts, pg_catalog.websearch_to_tsquery('spanish', public.unaccent_inmutable(query_text))) desc
    ) as rango
    from permitidos
    where fts @@ pg_catalog.websearch_to_tsquery('spanish', public.unaccent_inmutable(query_text))
    limit least(match_count, 30) * 2
  ),
  semantica as (
    select id, row_number() over (order by embedding operator(extensions.<=>) query_embedding) as rango
    from permitidos
    where embedding is not null and query_embedding is not null
    order by embedding operator(extensions.<=>) query_embedding
    limit least(match_count, 30) * 2
  )
  select p.id, p.s_id, p.s_titulo, p.s_grupo, p.texto, p.localizador,
    coalesce(1.0 / (rrf_k + t.rango), 0.0) * full_text_weight
      + coalesce(1.0 / (rrf_k + se.rango), 0.0) * semantic_weight as puntaje
  from texto_completo t
  full outer join semantica se on se.id = t.id
  join permitidos p on p.id = coalesce(t.id, se.id)
  order by puntaje desc
  limit least(match_count, 30);
$$;
revoke execute on function public.hybrid_search(text, extensions.vector, integer, text, text, text, real, real, integer) from public, anon;
grant execute on function public.hybrid_search(text, extensions.vector, integer, text, text, text, real, real, integer) to authenticated, service_role;
