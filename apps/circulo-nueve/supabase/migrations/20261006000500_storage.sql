-- Círculo Nueve · Buckets privados. Rutas: {expediente_uuid}/{uuid}.{ext}.
-- Biblioteca y cuarentena: sin políticas para usuarios (solo service role).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('cuarentena', 'cuarentena', false, 104857600, null),
  ('biblioteca-originales', 'biblioteca-originales', false, 104857600, null),
  ('biblioteca-derivados', 'biblioteca-derivados', false, 52428800, null),
  ('expedientes', 'expedientes', false, 26214400, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create function public.expediente_de_ruta(ruta text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
declare
  primera text := split_part(ruta, '/', 1);
begin
  if primera ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return primera::uuid;
  end if;
  return null;
end;
$$;

create policy "expedientes: abrir archivos autorizados"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expedientes'
    and (select public.has_case_perm(public.expediente_de_ruta(name), 'abrir_descargar'))
  );

create policy "expedientes: cargar archivos autorizados"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'expedientes'
    and public.expediente_de_ruta(name) is not null
    and (select public.has_case_perm(public.expediente_de_ruta(name), 'cargar'))
  );

create policy "expedientes: modificar archivos autorizados"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'expedientes'
    and (select public.has_case_perm(public.expediente_de_ruta(name), 'modificar'))
  )
  with check (
    bucket_id = 'expedientes'
    and (select public.has_case_perm(public.expediente_de_ruta(name), 'modificar'))
  );

create policy "expedientes: borrar archivos autorizados"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'expedientes'
    and (select public.has_case_perm(public.expediente_de_ruta(name), 'borrar'))
  );

-- Defensa en profundidad: el rol anónimo no toca ninguna tabla de public.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from anon;
