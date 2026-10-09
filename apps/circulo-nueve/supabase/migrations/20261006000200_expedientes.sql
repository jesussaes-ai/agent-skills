-- Circulo Nueve · Expedientes, perfiles de nacimiento, consentimientos, lecturas,
-- documentos y enlaces para compartir. Cada dato pertenece a un expediente y
-- se autoriza con has_case_perm.

create table public.case_files (
  id uuid primary key default gen_random_uuid(),
  display_label text not null check (char_length(display_label) between 1 and 120),
  created_by uuid not null references auth.users (id) on delete restrict,
  -- Persona cliente con cuenta propia (opcional): ve solo su expediente.
  client_user_id uuid references auth.users (id) on delete set null,
  status text not null default 'activo' check (status in ('activo', 'archivado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index case_files_created_by_idx on public.case_files (created_by);
create index case_files_client_user_id_idx on public.case_files (client_user_id);
alter table public.case_files enable row level security;

create table public.case_file_grants (
  case_file_id uuid not null references public.case_files (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  permissions text[] not null check (cardinality(permissions) > 0),
  granted_by uuid not null references auth.users (id) on delete restrict,
  granted_at timestamptz not null default now(),
  expires_at timestamptz,
  primary key (case_file_id, user_id)
);
create index case_file_grants_user_id_idx on public.case_file_grants (user_id);
alter table public.case_file_grants enable row level security;

create function public.validar_permisos_grant()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if exists (
    select 1 from unnest(new.permissions) p
    where p not in ('listar', 'abrir_descargar', 'cargar', 'modificar', 'borrar', 'compartir')
  ) then
    raise exception 'Permiso no asignable por expediente: %', new.permissions;
  end if;
  return new;
end;
$$;

create trigger case_file_grants_validar
  before insert or update on public.case_file_grants
  for each row execute function public.validar_permisos_grant();

-- Permiso efectivo sobre un expediente.
create function public.has_case_perm(case_id uuid, p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and (
    public.has_global_perm(p)
    or exists (
      select 1 from public.case_files c
      where c.id = case_id and c.created_by = (select auth.uid()) and public.has_perm(p)
    )
    or exists (
      select 1 from public.case_file_grants g
      where g.case_file_id = case_id
        and g.user_id = (select auth.uid())
        and p = any (g.permissions)
        and (g.expires_at is null or g.expires_at > now())
    )
    or (
      p in ('listar', 'abrir_descargar')
      and exists (
        select 1 from public.case_files c
        where c.id = case_id and c.client_user_id = (select auth.uid())
      )
    )
  );
$$;
revoke execute on function public.has_case_perm(uuid, text) from public, anon;
grant execute on function public.has_case_perm(uuid, text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
create table public.birth_profiles (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null unique references public.case_files (id) on delete cascade,
  birth_name text,
  preferred_name text,
  birth_date date,
  birth_time time,
  birth_time_precision text not null default 'desconocida'
    check (birth_time_precision in ('exacta', 'aproximada', 'desconocida')),
  birth_place text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  tz_id text,
  tz_source text,
  preferences jsonb not null default '{}'::jsonb,
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (birth_time_precision <> 'desconocida' or birth_time is null)
);
alter table public.birth_profiles enable row level security;

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  case_file_id uuid references public.case_files (id) on delete cascade,
  tipo text not null check (
    tipo in ('usar_conversacion', 'guardar_perfil', 'guardar_historial', 'entrenamiento')
    or tipo like 'envio_externo:%'
  ),
  otorgado boolean not null,
  version_texto text not null,
  otorgado_at timestamptz not null default now(),
  revocado_at timestamptz,
  check (num_nonnulls(user_id, case_file_id) = 1)
);
alter table public.consents enable row level security;

create table public.readings (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files (id) on delete cascade,
  sistema text not null check (sistema in ('numerologia', 'carta_natal', 'cabala')),
  motor text not null,
  motor_version text not null,
  reglas_version text not null,
  entradas_hash text not null,
  resultado_calculado jsonb not null,
  interpretacion text,
  interpretacion_origen text check (interpretacion_origen in ('tradicional', 'ia')),
  ratio_aportadas numeric(5, 4) check (ratio_aportadas between 0 and 1),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index readings_case_file_id_idx on public.readings (case_file_id);
alter table public.readings enable row level security;

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files (id) on delete cascade,
  storage_path text not null unique,
  version_plantilla text not null,
  retener_hasta date,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_case_file_id_idx on public.documents (case_file_id);
alter table public.documents enable row level security;

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  case_file_id uuid not null references public.case_files (id) on delete cascade,
  document_id uuid references public.documents (id) on delete cascade,
  token_hash text not null unique,
  alcance text not null check (alcance in ('lectura', 'descarga')),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  accesos integer not null default 0,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);
create index share_links_case_file_id_idx on public.share_links (case_file_id);
alter table public.share_links enable row level security;

create table public.privacy_notice_settings (
  id boolean primary key default true check (id),
  responsable text,
  finalidades text,
  datos_tratados text,
  conservacion text,
  derechos text,
  contacto text,
  updated_at timestamptz not null default now()
);
insert into public.privacy_notice_settings (id) values (true);
alter table public.privacy_notice_settings enable row level security;

-- ---------------------------------------------------------------------------
-- Políticas

create policy "listar expedientes autorizados"
  on public.case_files for select to authenticated
  using ((select public.has_case_perm(id, 'listar')));

create policy "crear expedientes propios"
  on public.case_files for insert to authenticated
  with check ((select public.has_perm('cargar')) and created_by = (select auth.uid()));

create policy "modificar expedientes autorizados"
  on public.case_files for update to authenticated
  using ((select public.has_case_perm(id, 'modificar')))
  with check ((select public.has_case_perm(id, 'modificar')));

create policy "borrar expedientes autorizados"
  on public.case_files for delete to authenticated
  using ((select public.has_case_perm(id, 'borrar')));

create policy "ver asignaciones propias o administración"
  on public.case_file_grants for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('admin_usuarios')));

create policy "administración asigna expedientes a otros"
  on public.case_file_grants for insert to authenticated
  with check (
    (select public.has_perm('admin_usuarios'))
    and user_id <> (select auth.uid())
    and granted_by = (select auth.uid())
  );

create policy "administración modifica asignaciones ajenas"
  on public.case_file_grants for update to authenticated
  using ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()))
  with check ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()));

create policy "administración retira asignaciones"
  on public.case_file_grants for delete to authenticated
  using ((select public.has_perm('admin_usuarios')));

-- Tablas hijas de un expediente: mismo patrón de permisos.
create policy "abrir perfil de nacimiento"
  on public.birth_profiles for select to authenticated
  using ((select public.has_case_perm(case_file_id, 'abrir_descargar')));
create policy "crear perfil de nacimiento"
  on public.birth_profiles for insert to authenticated
  with check ((select public.has_case_perm(case_file_id, 'modificar')));
create policy "modificar perfil de nacimiento"
  on public.birth_profiles for update to authenticated
  using ((select public.has_case_perm(case_file_id, 'modificar')))
  with check ((select public.has_case_perm(case_file_id, 'modificar')));
create policy "borrar perfil de nacimiento"
  on public.birth_profiles for delete to authenticated
  using ((select public.has_case_perm(case_file_id, 'borrar')));

create policy "abrir lecturas"
  on public.readings for select to authenticated
  using ((select public.has_case_perm(case_file_id, 'abrir_descargar')));
create policy "crear lecturas"
  on public.readings for insert to authenticated
  with check ((select public.has_case_perm(case_file_id, 'modificar')) and created_by = (select auth.uid()));
create policy "borrar lecturas"
  on public.readings for delete to authenticated
  using ((select public.has_case_perm(case_file_id, 'borrar')));

create policy "abrir documentos"
  on public.documents for select to authenticated
  using ((select public.has_case_perm(case_file_id, 'abrir_descargar')));
create policy "borrar documentos"
  on public.documents for delete to authenticated
  using ((select public.has_case_perm(case_file_id, 'borrar')));

create policy "ver enlaces compartidos"
  on public.share_links for select to authenticated
  using ((select public.has_case_perm(case_file_id, 'compartir')));
create policy "crear enlaces compartidos"
  on public.share_links for insert to authenticated
  with check (
    (select public.has_case_perm(case_file_id, 'compartir'))
    and created_by = (select auth.uid())
    and expires_at <= now() + interval '30 days'
  );
create policy "revocar enlaces compartidos"
  on public.share_links for update to authenticated
  using ((select public.has_case_perm(case_file_id, 'compartir')))
  with check ((select public.has_case_perm(case_file_id, 'compartir')));

create policy "ver consentimientos"
  on public.consents for select to authenticated
  using (
    user_id = (select auth.uid())
    or (case_file_id is not null and (select public.has_case_perm(case_file_id, 'abrir_descargar')))
  );
create policy "registrar consentimientos"
  on public.consents for insert to authenticated
  with check (
    (user_id = (select auth.uid()) and (select public.es_usuario_activo()))
    or (case_file_id is not null and (select public.has_case_perm(case_file_id, 'modificar')))
  );
create policy "revocar consentimientos"
  on public.consents for update to authenticated
  using (
    user_id = (select auth.uid())
    or (case_file_id is not null and (select public.has_case_perm(case_file_id, 'modificar')))
  )
  with check (
    user_id = (select auth.uid())
    or (case_file_id is not null and (select public.has_case_perm(case_file_id, 'modificar')))
  );

create policy "leer aviso de privacidad"
  on public.privacy_notice_settings for select to authenticated using (true);
create policy "administración edita aviso de privacidad"
  on public.privacy_notice_settings for update to authenticated
  using ((select public.has_perm('admin_usuarios')))
  with check ((select public.has_perm('admin_usuarios')));

create trigger case_files_updated_at before update on public.case_files
  for each row execute function public.tocar_updated_at();
create trigger birth_profiles_updated_at before update on public.birth_profiles
  for each row execute function public.tocar_updated_at();
create trigger privacy_notice_settings_updated_at before update on public.privacy_notice_settings
  for each row execute function public.tocar_updated_at();
