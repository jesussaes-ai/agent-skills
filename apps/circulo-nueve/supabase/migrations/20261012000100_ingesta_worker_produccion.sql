-- Worker de ingesta en producción (ver docs/biblioteca.md, «Worker de ingesta»).
-- 1. La app en Vercel solo toma trabajos ligeros (texto, EPUB, DOCX, PDF con texto, web,
--    indexado); el OCR, el audio y el video quedan para el worker de GitHub Actions.
-- 2. Un trabajo interrumpido (función cortada por tiempo, runner cancelado) vuelve a la
--    cola; al tercer intento se marca fallido en lugar de quedarse «procesando».

alter table public.ingestion_jobs
  add column requiere_worker boolean not null default false,
  add column tomado_ligero boolean not null default false;

drop function public.tomar_trabajo_ingesta();

create function public.tomar_trabajo_ingesta(p_solo_ligeros boolean default false)
returns setof public.ingestion_jobs
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_interrumpido constant text := 'El procesamiento se interrumpió tres veces (tiempo agotado). Prueba con un archivo más pequeño o divídelo.';
begin
  with agotados as (
    update public.ingestion_jobs j
    set estado = 'fallido', terminado_at = now(), errores = jsonb_build_array(v_interrumpido)
    where j.estado = 'procesando'
      and j.intentos >= 3
      and j.iniciado_at < now() - case when j.tomado_ligero then interval '10 minutes' else interval '4 hours' end
    returning j.source_id
  )
  update public.sources s set estado = 'fallido', motivo_fallo = v_interrumpido
  where s.id in (select source_id from agotados);

  return query
  update public.ingestion_jobs j
  set estado = 'procesando', iniciado_at = now(), intentos = j.intentos + 1, tomado_ligero = p_solo_ligeros
  where j.id = (
    select c.id from public.ingestion_jobs c
    where (
        c.estado = 'pendiente'
        or (c.estado = 'procesando' and c.intentos < 3
            and c.iniciado_at < now() - case when c.tomado_ligero then interval '10 minutes' else interval '4 hours' end)
      )
      and (
        not p_solo_ligeros
        or c.etapa = 'indexar'
        or (not c.requiere_worker and (
          c.url is not null
          or lower(coalesce(c.nombre_archivo, '')) ~ '\.(pdf|epub|docx|txt|md|markdown|csv|xlsx|ods|pptx)$'
        ))
      )
    order by c.created_at
    for update skip locked
    limit 1
  )
  returning j.*;
end;
$$;
revoke execute on function public.tomar_trabajo_ingesta(boolean) from public, anon, authenticated;
grant execute on function public.tomar_trabajo_ingesta(boolean) to service_role;

-- Devuelve a la cola, para el worker con OCR, un trabajo que la app no puede terminar.
create function public.ceder_trabajo_al_worker(p_trabajo uuid)
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.ingestion_jobs
  set estado = 'pendiente', requiere_worker = true, intentos = greatest(intentos - 1, 0), iniciado_at = null
  where id = p_trabajo and estado = 'procesando';
  update public.sources s set estado = 'pendiente', motivo_fallo = null
  from public.ingestion_jobs j
  where j.id = p_trabajo and s.id = j.source_id;
$$;
revoke execute on function public.ceder_trabajo_al_worker(uuid) from public, anon, authenticated;
grant execute on function public.ceder_trabajo_al_worker(uuid) to service_role;

-- Cuántos trabajos esperan (el workflow no instala nada si no hay ninguno).
create function public.trabajos_ingesta_pendientes()
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.ingestion_jobs
  where estado = 'pendiente'
     or (estado = 'procesando' and iniciado_at < now() - case when tomado_ligero then interval '10 minutes' else interval '4 hours' end);
$$;
revoke execute on function public.trabajos_ingesta_pendientes() from public, anon, authenticated;
grant execute on function public.trabajos_ingesta_pendientes() to service_role;
