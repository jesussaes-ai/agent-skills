-- Círculo Nueve · Expedientes en la interfaz: consentimiento exigido por la base,
-- permisos por archivo, retención configurable de documentos y recuperación de
-- emergencia de la administración.

-- ---------------------------------------------------------------------------
-- Ajustes generales (fila única)
create table public.app_settings (
  id boolean primary key default true check (id),
  retencion_documentos_dias integer not null default 365 check (retencion_documentos_dias between 1 and 3650),
  vigencia_url_firmada_segundos integer not null default 60 check (vigencia_url_firmada_segundos between 10 and 600),
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id) values (true);
alter table public.app_settings enable row level security;

create policy "ajustes legibles"
  on public.app_settings for select to authenticated using (true);
create policy "administración edita ajustes"
  on public.app_settings for update to authenticated
  using ((select public.has_perm('admin_usuarios')))
  with check ((select public.has_perm('admin_usuarios')));
create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.tocar_updated_at();

-- ---------------------------------------------------------------------------
-- Consentimientos: cada cambio es un registro nuevo; manda el último.
alter table public.consents add column secuencia bigint generated always as identity;
alter table public.consents alter column otorgado_at set default clock_timestamp();

-- Consentimiento vigente: el último registro del tipo para el expediente.
create function public.consentimiento_vigente(case_id uuid, p_tipo text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select c.otorgado and c.revocado_at is null
    from public.consents c
    where c.case_file_id = case_id and c.tipo = p_tipo
    order by c.secuencia desc
    limit 1
  ), false);
$$;
revoke execute on function public.consentimiento_vigente(uuid, text) from public, anon;
grant execute on function public.consentimiento_vigente(uuid, text) to authenticated, service_role;

-- Solo se exige en peticiones de usuarios (auth.uid() presente); los procesos
-- de servidor con service role y las migraciones no pasan por aquí.
create function public.exigir_consentimiento()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  tipo text := tg_argv[0];
begin
  -- Sin permiso de modificar, RLS rechaza la fila sin revelar que el expediente existe.
  if (select auth.uid()) is not null
     and public.has_case_perm(new.case_file_id, 'modificar')
     and not public.consentimiento_vigente(new.case_file_id, tipo) then
    raise exception 'Falta el consentimiento «%» para este expediente', tipo using errcode = 'CN001';
  end if;
  return new;
end;
$$;

create trigger birth_profiles_consentimiento before insert or update on public.birth_profiles
  for each row execute function public.exigir_consentimiento('guardar_perfil');
create trigger readings_consentimiento before insert on public.readings
  for each row execute function public.exigir_consentimiento('guardar_historial');

-- ---------------------------------------------------------------------------
-- Vincular una cuenta cliente da acceso de lectura: exige permiso de compartir.
create function public.proteger_cliente_vinculado()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'INSERT' and new.client_user_id is not null and not public.has_perm('compartir') then
    raise exception 'Vincular una cuenta cliente requiere permiso de compartir' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and new.client_user_id is distinct from old.client_user_id
     and not public.has_case_perm(old.id, 'compartir') then
    raise exception 'Vincular una cuenta cliente requiere permiso de compartir' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger case_files_cliente before insert or update on public.case_files
  for each row execute function public.proteger_cliente_vinculado();

-- ---------------------------------------------------------------------------
-- Documentos: metadatos, retención y permisos por archivo.
alter table public.documents
  add column reading_id uuid references public.readings (id) on delete set null,
  add column tipo text not null default 'reporte' check (tipo in ('reporte', 'adjunto')),
  add column nombre text,
  add column sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  add column tamano_bytes integer check (tamano_bytes >= 0);

alter table public.documents
  add constraint documents_ruta_del_expediente check (storage_path like case_file_id::text || '/%');

-- Generar un reporte de una lectura propia crea su documento; el archivo lo sube el servidor.
create policy "registrar documentos generados"
  on public.documents for insert to authenticated
  with check (
    (select public.has_case_perm(case_file_id, 'abrir_descargar'))
    and created_by = (select auth.uid())
    and (reading_id is null or exists (
      select 1 from public.readings r where r.id = reading_id and r.case_file_id = documents.case_file_id
    ))
  );

alter table public.case_files add column es_demo boolean not null default false;

create function public.fijar_retencion_documento()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.retener_hasta is null then
    new.retener_hasta := current_date + (select retencion_documentos_dias from public.app_settings where id);
  end if;
  return new;
end;
$$;
create trigger documents_retencion before insert on public.documents
  for each row execute function public.fijar_retencion_documento();

create table public.document_grants (
  document_id uuid not null references public.documents (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  granted_by uuid not null references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (document_id, user_id)
);
create index document_grants_user_id_idx on public.document_grants (user_id);
alter table public.document_grants enable row level security;

create function public.has_document_perm(doc_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and exists (
    select 1 from public.documents d
    where d.id = doc_id
      and (
        public.has_case_perm(d.case_file_id, 'abrir_descargar')
        or exists (
          select 1 from public.document_grants g
          where g.document_id = d.id
            and g.user_id = (select auth.uid())
            and (g.expires_at is null or g.expires_at > now())
        )
      )
  );
$$;
revoke execute on function public.has_document_perm(uuid) from public, anon;
grant execute on function public.has_document_perm(uuid) to authenticated, service_role;

drop policy "abrir documentos" on public.documents;
create policy "abrir documentos autorizados"
  on public.documents for select to authenticated
  using ((select public.has_document_perm(id)));

create policy "ver permisos de archivo propios o administración"
  on public.document_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('admin_usuarios')));
create policy "administración da permisos de archivo a otros"
  on public.document_grants for insert to authenticated
  with check (
    (select public.has_perm('admin_usuarios'))
    and user_id <> (select auth.uid())
    and granted_by = (select auth.uid())
  );
create policy "administración retira permisos de archivo"
  on public.document_grants for delete to authenticated
  using ((select public.has_perm('admin_usuarios')));

create trigger auditar_document_grants after insert or delete on public.document_grants
  for each row execute function public.auditar_cambio();

drop policy "expedientes: abrir archivos autorizados" on storage.objects;
create policy "expedientes: abrir archivos autorizados"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'expedientes'
    and (
      (select public.has_case_perm(public.expediente_de_ruta(name), 'abrir_descargar'))
      or exists (
        select 1 from public.documents d
        where d.storage_path = name and public.has_document_perm(d.id)
      )
    )
  );

-- registrar_acceso admite también el acceso por permiso de archivo.
create or replace function public.registrar_acceso(p_accion text, p_recurso_tipo text, p_recurso_id text, p_expediente uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_accion not in ('abrir', 'descargar', 'compartir', 'exportar') then
    raise exception 'Acción de auditoría no válida: %', p_accion;
  end if;
  if not (
    public.has_case_perm(p_expediente, 'abrir_descargar')
    or (p_recurso_tipo = 'documents' and public.has_document_perm(p_recurso_id::uuid))
  ) then
    raise exception 'Sin permiso sobre el recurso' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, expediente_id)
  values ((select auth.uid()), p_accion, p_recurso_tipo, p_recurso_id, p_expediente);
end;
$$;

-- Documentos con retención vencida, para el proceso de purga del servidor.
create function public.documentos_vencidos(p_limite integer default 100)
returns table (id uuid, storage_path text)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.storage_path from public.documents d
  where d.retener_hasta < current_date
  order by d.retener_hasta
  limit greatest(1, least(p_limite, 1000));
$$;
revoke execute on function public.documentos_vencidos(integer) from public, anon, authenticated;
grant execute on function public.documentos_vencidos(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Recuperación de emergencia de la administración (solo service role, auditada).
create function public.recuperacion_emergencia_admin(p_user_id uuid, p_motivo text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if char_length(coalesce(trim(p_motivo), '')) < 10 then
    raise exception 'Indica el motivo de la recuperación (mínimo 10 caracteres)' using errcode = 'P0001';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'La cuenta no existe' using errcode = 'P0001';
  end if;
  insert into public.user_profiles (user_id, display_name, status)
    values (p_user_id, 'Administración', 'activo')
    on conflict (user_id) do update set status = 'activo';
  insert into public.user_roles (user_id, role_id, granted_by)
    values (p_user_id, 'admin', p_user_id)
    on conflict (user_id, role_id) do nothing;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id, detalle)
    values (null, 'recuperacion_emergencia_admin', 'user_roles', p_user_id::text, jsonb_build_object('motivo', trim(p_motivo)));
end;
$$;
revoke execute on function public.recuperacion_emergencia_admin(uuid, text) from public, anon, authenticated;
grant execute on function public.recuperacion_emergencia_admin(uuid, text) to service_role;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
