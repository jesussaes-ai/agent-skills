-- Círculo Nueve · Enlaces para compartir un PDF o los PDF de un expediente, que
-- vencen y se pueden revocar; retención configurable de enlaces y auditoría;
-- límites de frecuencia compartidos entre instancias del servidor.

-- ---------------------------------------------------------------------------
-- Ajustes: vigencia máxima de los enlaces y retención de registros.
alter table public.app_settings
  add column enlace_vigencia_max_dias integer not null default 7 check (enlace_vigencia_max_dias between 1 and 30),
  add column retencion_enlaces_dias integer not null default 90 check (retencion_enlaces_dias between 1 and 3650),
  add column retencion_auditoria_dias integer not null default 730 check (retencion_auditoria_dias between 365 and 3650);

-- ---------------------------------------------------------------------------
-- Enlaces compartidos. Solo se guarda el SHA-256 del token; el token se muestra una vez.
alter table public.share_links drop constraint share_links_alcance_check;
alter table public.share_links
  add constraint share_links_alcance_check check (alcance in ('documento', 'expediente')),
  add constraint share_links_alcance_documento check ((alcance = 'documento') = (document_id is not null)),
  add constraint share_links_token_hash_formato check (token_hash ~ '^[0-9a-f]{64}$'),
  add column nota text check (char_length(nota) <= 120),
  add column max_accesos integer check (max_accesos between 1 and 1000),
  add column ultimo_acceso_at timestamptz,
  add column revoked_by uuid references auth.users (id) on delete set null;
create index share_links_document_id_idx on public.share_links (document_id);

-- Crear exige compartir sobre el expediente, poder ver el documento y respetar la vigencia máxima.
drop policy "crear enlaces compartidos" on public.share_links;
create policy "crear enlaces compartidos"
  on public.share_links for insert to authenticated
  with check (
    (select public.has_case_perm(case_file_id, 'compartir'))
    and created_by = (select auth.uid())
    and revoked_at is null
    and revoked_by is null
    and accesos = 0
    and expires_at <= now() + make_interval(days => (select s.enlace_vigencia_max_dias from public.app_settings s where s.id))
    and (document_id is null or exists (
      select 1 from public.documents d where d.id = document_id and d.case_file_id = share_links.case_file_id
    ))
  );

-- Desde la app solo se puede revocar: ningún otro campo cambia y no se puede deshacer.
create function public.proteger_enlace_compartido()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if old.revoked_at is not null then
    raise exception 'El enlace ya estaba revocado' using errcode = 'P0001';
  end if;
  if new.revoked_at is null
     or row(new.case_file_id, new.document_id, new.token_hash, new.alcance, new.expires_at, new.accesos,
            new.created_by, new.created_at, new.nota, new.max_accesos, new.ultimo_acceso_at)
        is distinct from
        row(old.case_file_id, old.document_id, old.token_hash, old.alcance, old.expires_at, old.accesos,
            old.created_by, old.created_at, old.nota, old.max_accesos, old.ultimo_acceso_at) then
    raise exception 'Un enlace compartido solo se puede revocar' using errcode = '42501';
  end if;
  new.revoked_at := now();
  new.revoked_by := (select auth.uid());
  return new;
end;
$$;
create trigger share_links_solo_revocar before update on public.share_links
  for each row execute function public.proteger_enlace_compartido();

-- Auditoría propia de los enlaces: nunca copia el hash del token.
drop trigger auditar_share_links on public.share_links;
create function public.auditar_enlace_compartido()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  fila public.share_links := coalesce(new, old);
begin
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, expediente_id, detalle)
  values (
    (select auth.uid()),
    case tg_op when 'INSERT' then 'crear_enlace' when 'UPDATE' then 'revocar_enlace' else 'borrar_enlace' end,
    'share_links',
    fila.id::text,
    fila.case_file_id,
    jsonb_strip_nulls(jsonb_build_object(
      'alcance', fila.alcance,
      'documento', fila.document_id,
      'vence', fila.expires_at,
      'max_accesos', fila.max_accesos,
      'accesos', case when tg_op = 'INSERT' then null else fila.accesos end
    ))
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.auditar_enlace_compartido() from public, anon, authenticated;
create trigger auditar_share_links after insert or delete or update of revoked_at on public.share_links
  for each row execute function public.auditar_enlace_compartido();

-- Uso público del enlace (solo el servidor, con la llave de servicio, tras calcular el hash).
-- Sin documento: consulta la lista. Con documento: cuenta un acceso. Todo intento queda auditado.
create function public.usar_enlace_compartido(p_token_hash text, p_documento uuid default null, p_origen text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  e public.share_links;
  resultado text;
  documentos jsonb;
begin
  select * into e from public.share_links where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('estado', 'no_existe');
  end if;

  resultado := case
    when e.revoked_at is not null then 'revocado'
    when e.expires_at <= now() then 'vencido'
    when p_documento is not null and e.max_accesos is not null and e.accesos >= e.max_accesos then 'agotado'
    when p_documento is not null and not exists (
      select 1 from public.documents d
      where d.id = p_documento and d.case_file_id = e.case_file_id and (e.document_id is null or d.id = e.document_id)
    ) then 'documento_no_disponible'
    else 'ok'
  end;

  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, expediente_id, detalle)
  values (
    null,
    case when p_documento is null then 'abrir_enlace' else 'descargar_enlace' end,
    'share_links',
    e.id::text,
    e.case_file_id,
    jsonb_strip_nulls(jsonb_build_object('resultado', resultado, 'documento', p_documento, 'origen', left(p_origen, 64)))
  );

  if resultado <> 'ok' then
    return jsonb_build_object('estado', resultado);
  end if;
  if p_documento is not null then
    update public.share_links set accesos = accesos + 1, ultimo_acceso_at = now() where id = e.id;
    e.accesos := e.accesos + 1;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', d.id, 'nombre', coalesce(d.nombre, 'reporte.pdf'), 'creado', d.created_at,
      'tamano', d.tamano_bytes, 'ruta', d.storage_path
    ) order by d.created_at desc), '[]'::jsonb)
  into documentos
  from public.documents d
  where d.case_file_id = e.case_file_id
    and (e.document_id is null or d.id = e.document_id)
    and (p_documento is null or d.id = p_documento);

  return jsonb_build_object(
    'estado', 'ok',
    'alcance', e.alcance,
    'vence', e.expires_at,
    'nota', e.nota,
    'accesos', e.accesos,
    'maxAccesos', e.max_accesos,
    'documentos', documentos
  );
end;
$$;
revoke execute on function public.usar_enlace_compartido(text, uuid, text) from public, anon, authenticated;
grant execute on function public.usar_enlace_compartido(text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Límites de frecuencia (ventana fija). La clave es un SHA-256: no guarda IP ni usuario.
create table public.limites_frecuencia (
  clave text primary key check (clave ~ '^[0-9a-f]{64}$'),
  ventana_inicio timestamptz not null,
  conteo integer not null check (conteo >= 0)
);
alter table public.limites_frecuencia enable row level security;
revoke all on public.limites_frecuencia from anon, authenticated;

-- Suma p_cantidad intentos (0 = solo consulta) y devuelve 0 si se permite;
-- si no, los segundos que faltan para reintentar.
create function public.consumir_limite(p_clave text, p_maximo integer, p_ventana_segundos integer, p_cantidad integer default 1)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  ventana interval := make_interval(secs => greatest(1, p_ventana_segundos));
  n integer := greatest(0, p_cantidad);
  c integer;
  v timestamptz;
begin
  insert into public.limites_frecuencia as l (clave, ventana_inicio, conteo)
  values (p_clave, now(), n)
  on conflict (clave) do update set
    conteo = case when l.ventana_inicio + ventana <= now() then n else l.conteo + n end,
    ventana_inicio = case when l.ventana_inicio + ventana <= now() then now() else l.ventana_inicio end
  returning conteo, ventana_inicio into c, v;
  if c > p_maximo or (n = 0 and c >= p_maximo) then
    return greatest(1, ceil(extract(epoch from (v + ventana - now())))::integer);
  end if;
  return 0;
end;
$$;
revoke execute on function public.consumir_limite(text, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Retención de registros: la auditoría solo pierde filas más antiguas que su plazo
-- y únicamente dentro de la purga (la marca de sesión no basta para filas recientes).
create or replace function public.impedir_cambios_auditoria()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE'
     and current_setting('circulo.purga_auditoria', true) = 'on'
     and old.created_at < now() - make_interval(days => (select s.retencion_auditoria_dias from public.app_settings s where s.id)) then
    return old;
  end if;
  raise exception 'audit_log es de solo inserción';
end;
$$;

create function public.purgar_registros_vencidos()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  ajustes public.app_settings;
  enlaces integer;
  auditoria integer;
  limites integer;
begin
  select * into ajustes from public.app_settings where id;
  delete from public.share_links
  where coalesce(revoked_at, expires_at) < now() - make_interval(days => ajustes.retencion_enlaces_dias);
  get diagnostics enlaces = row_count;

  perform set_config('circulo.purga_auditoria', 'on', true);
  delete from public.audit_log
  where created_at < now() - make_interval(days => ajustes.retencion_auditoria_dias);
  get diagnostics auditoria = row_count;
  perform set_config('circulo.purga_auditoria', 'off', true);

  delete from public.limites_frecuencia where ventana_inicio < now() - interval '1 day';
  get diagnostics limites = row_count;

  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, detalle)
  values (null, 'purga_retencion', 'registros', null,
          jsonb_build_object('enlaces', enlaces, 'auditoria', auditoria, 'limites', limites));
  return jsonb_build_object('enlaces', enlaces, 'auditoria', auditoria, 'limites', limites);
end;
$$;
revoke execute on function public.purgar_registros_vencidos() from public, anon, authenticated;
grant execute on function public.purgar_registros_vencidos() to service_role;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
