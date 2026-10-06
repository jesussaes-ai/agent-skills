-- Círculo Nueve · Biblioteca: figuras con descripción y OCR, y carga directa.

-- Cuarentena: 50 MB por archivo (límite del plan gratuito de Supabase).
update storage.buckets set file_size_limit = 52428800 where id = 'cuarentena';

-- La administración de fuentes revisa las figuras y corrige su descripción.
create policy "administración de fuentes revisa figuras"
  on public.visual_assets for select to authenticated
  using ((select public.has_perm('admin_fuentes')));
create policy "administración de fuentes corrige figuras"
  on public.visual_assets for update to authenticated
  using ((select public.has_perm('admin_fuentes')))
  with check ((select public.has_perm('admin_fuentes')));

create function public.proteger_figura()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and (
    new.storage_path is distinct from old.storage_path
    or new.descripcion_generada is distinct from old.descripcion_generada
    or new.descripcion_modelo is distinct from old.descripcion_modelo
    or new.ocr is distinct from old.ocr
    or new.leyenda is distinct from old.leyenda
    or new.source_version_id is distinct from old.source_version_id
  ) then
    raise exception 'En la revisión solo se puede corregir la descripción' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger visual_assets_proteger before update on public.visual_assets
  for each row execute function public.proteger_figura();

create policy "administración de fuentes ve vínculos de figuras"
  on public.chunk_visual_links for select to authenticated
  using ((select public.has_perm('admin_fuentes')));

-- Figuras de fragmentos consultables por quien pregunta (mismos criterios que hybrid_search).
create function public.figuras_de_fragmentos(ids uuid[])
returns table (chunk_id uuid, figura_id uuid, pagina text, leyenda text, descripcion text, correccion text)
language sql stable security definer set search_path = ''
as $$
  select l.chunk_id, a.id, a.pagina, a.leyenda, a.descripcion_generada, a.correccion_admin
  from public.chunk_visual_links l
  join public.visual_assets a on a.id = l.visual_asset_id
  join public.chunks c on c.id = l.chunk_id
  join public.source_versions v on v.id = c.source_version_id and v.es_vigente
  join public.sources s on s.id = v.source_id and s.estado = 'indexado'
  where l.chunk_id = any (ids)
    and not c.excluido
    and c.nivel_acceso = any (public.niveles_acceso_permitidos())
    and s.nivel_acceso = any (public.niveles_acceso_permitidos());
$$;
revoke execute on function public.figuras_de_fragmentos(uuid[]) from public, anon;
grant execute on function public.figuras_de_fragmentos(uuid[]) to authenticated, service_role;

create function public.ruta_figura_autorizada(p_figura uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select a.storage_path
  from public.visual_assets a
  join public.chunk_visual_links l on l.visual_asset_id = a.id
  join public.chunks c on c.id = l.chunk_id
  join public.source_versions v on v.id = c.source_version_id
  join public.sources s on s.id = v.source_id
  where a.id = p_figura
    and (
      public.has_perm('admin_fuentes')
      or (v.es_vigente and s.estado = 'indexado' and not c.excluido
          and c.nivel_acceso = any (public.niveles_acceso_permitidos())
          and s.nivel_acceso = any (public.niveles_acceso_permitidos()))
    )
  limit 1;
$$;
revoke execute on function public.ruta_figura_autorizada(uuid) from public, anon;
grant execute on function public.ruta_figura_autorizada(uuid) to authenticated, service_role;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
