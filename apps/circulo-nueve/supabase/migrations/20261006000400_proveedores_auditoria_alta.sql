-- Círculo Nueve · Proveedores de IA (sin secretos), registro de uso (sin prompts),
-- auditoría de solo inserción y alta inicial del administrador.

create table public.ai_providers (
  id text primary key,
  nombre text not null,
  endpoint text,
  modelo text not null,
  -- Nombre del secreto de servidor que guarda la llave; nunca la llave.
  secreto_nombre text,
  capacidades jsonb not null default '{}'::jsonb,
  permite_datos_reales boolean not null default false,
  limite_mensual_usd numeric(10, 2) check (limite_mensual_usd >= 0),
  activo boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.ai_providers enable row level security;

create table public.ai_usage (
  id bigint generated always as identity primary key,
  provider_id text not null references public.ai_providers (id) on delete cascade,
  modelo text not null,
  user_id uuid references auth.users (id) on delete set null,
  tokens_entrada integer check (tokens_entrada >= 0),
  tokens_salida integer check (tokens_salida >= 0),
  costo_estimado_usd numeric(10, 6) check (costo_estimado_usd >= 0),
  codigo_resultado text not null,
  created_at timestamptz not null default now()
);
alter table public.ai_usage enable row level security;

create policy "administración de proveedores ve proveedores"
  on public.ai_providers for select to authenticated using ((select public.has_perm('admin_proveedores')));
create policy "administración de proveedores edita proveedores"
  on public.ai_providers for update to authenticated
  using ((select public.has_perm('admin_proveedores')))
  with check ((select public.has_perm('admin_proveedores')));
create policy "administración de proveedores ve consumo"
  on public.ai_usage for select to authenticated using ((select public.has_perm('admin_proveedores')));

create trigger ai_providers_updated_at before update on public.ai_providers
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Auditoría: solo inserción mediante funciones/triggers; nadie puede modificarla.
create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  accion text not null,
  recurso_tipo text not null,
  recurso_id text,
  expediente_id uuid,
  detalle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_at_idx on public.audit_log (created_at desc);
alter table public.audit_log enable row level security;

create policy "administración lee la auditoría"
  on public.audit_log for select to authenticated using ((select public.has_perm('admin_usuarios')));

create function public.impedir_cambios_auditoria()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  raise exception 'audit_log es de solo inserción';
end;
$$;

create trigger audit_log_solo_insercion
  before update or delete on public.audit_log
  for each row execute function public.impedir_cambios_auditoria();
create trigger audit_log_sin_truncate
  before truncate on public.audit_log
  for each statement execute function public.impedir_cambios_auditoria();

revoke insert, update, delete, truncate on public.audit_log from anon, authenticated;

-- Registra la acción sin copiar contenido: solo identificadores.
create function public.auditar_cambio()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  fila jsonb := to_jsonb(coalesce(new, old));
  expediente uuid;
begin
  expediente := case
    when tg_table_name = 'case_files' then (fila ->> 'id')::uuid
    else (fila ->> 'case_file_id')::uuid
  end;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, expediente_id, detalle)
  values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(fila ->> 'id', fila ->> 'user_id'),
    expediente,
    case when tg_table_name = 'case_file_grants'
      then jsonb_build_object('usuario', fila ->> 'user_id', 'permisos', fila -> 'permissions')
      else '{}'::jsonb end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.auditar_cambio() from public, anon, authenticated;

create trigger auditar_case_files after insert or update or delete on public.case_files
  for each row execute function public.auditar_cambio();
create trigger auditar_case_file_grants after insert or update or delete on public.case_file_grants
  for each row execute function public.auditar_cambio();
create trigger auditar_birth_profiles after insert or update or delete on public.birth_profiles
  for each row execute function public.auditar_cambio();
create trigger auditar_readings after insert or update or delete on public.readings
  for each row execute function public.auditar_cambio();
create trigger auditar_documents after insert or update or delete on public.documents
  for each row execute function public.auditar_cambio();
create trigger auditar_share_links after insert or update or delete on public.share_links
  for each row execute function public.auditar_cambio();

-- Registro explícito de accesos (abrir/descargar), llamado por el servidor.
create function public.registrar_acceso(p_accion text, p_recurso_tipo text, p_recurso_id text, p_expediente uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_accion not in ('abrir', 'descargar', 'compartir', 'exportar') then
    raise exception 'Acción de auditoría no válida: %', p_accion;
  end if;
  if not public.has_case_perm(p_expediente, 'abrir_descargar') then
    raise exception 'Sin permiso sobre el expediente';
  end if;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, expediente_id)
  values ((select auth.uid()), p_accion, p_recurso_tipo, p_recurso_id, p_expediente);
end;
$$;
revoke execute on function public.registrar_acceso(text, text, text, uuid) from public, anon;
grant execute on function public.registrar_acceso(text, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Alta inicial del administrador. La ruta /setup del servidor valida la clave
-- (hash argon2id en ADMIN_SETUP_KEY_HASH) y luego llama a esta función con
-- service role. Solo funciona una vez.
create function public.completar_alta_admin(p_user_id uuid, p_display_name text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  ya timestamptz;
begin
  select completed_at into ya from public.app_setup where id for update;
  if ya is not null or exists (select 1 from public.user_roles where role_id = 'admin') then
    raise exception 'El alta inicial ya se completó' using errcode = 'P0001';
  end if;
  insert into public.user_profiles (user_id, display_name) values (p_user_id, p_display_name)
    on conflict (user_id) do update set display_name = excluded.display_name, status = 'activo';
  insert into public.user_roles (user_id, role_id, granted_by) values (p_user_id, 'admin', p_user_id);
  update public.app_setup set completed_at = now(), completed_by = p_user_id where id;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id)
    values (p_user_id, 'alta_inicial_admin', 'app_setup', 'app_setup');
end;
$$;
revoke execute on function public.completar_alta_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.completar_alta_admin(uuid, text) to service_role;
