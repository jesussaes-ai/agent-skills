-- Círculo Nueve · Cuentas v2: nombre de usuario y contraseña, verificación en
-- dos pasos opcional (obligatoria para quien la activa), cambio de contraseña
-- obligatorio al primer ingreso, permisos individuales para asistentes y
-- clientes en modo solo lectura.

-- ---------------------------------------------------------------------------
-- Perfil: nombre de usuario y cambio de contraseña pendiente.
alter table public.user_profiles
  add column username text,
  add column debe_cambiar_contrasena boolean not null default false,
  -- SHA-256 del hash de Auth al exigir el cambio: solo se libera si la contraseña cambió.
  add column huella_contrasena_pendiente text,
  add constraint user_profiles_username_formato check (username is null or username ~ '^[a-z][a-z0-9._-]{2,31}$');
create unique index user_profiles_username_idx on public.user_profiles (username);

-- ---------------------------------------------------------------------------
-- Verificación en dos pasos: opcional; si la cuenta tiene un factor verificado,
-- toda su actividad exige una sesión aal2.
create function public.nivel_mfa_suficiente()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.sesion_aal2() or not exists (
    select 1 from auth.mfa_factors f
    where f.user_id = (select auth.uid()) and f.status = 'verified'
  );
$$;
revoke execute on function public.nivel_mfa_suficiente() from public, anon;
grant execute on function public.nivel_mfa_suficiente() to authenticated, service_role;

-- Activa = estado activo, sin cambio de contraseña pendiente y con el nivel de sesión que exige su MFA.
create or replace function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.status = 'activo' and not p.debe_cambiar_contrasena
  ) and public.nivel_mfa_suficiente();
$$;

-- ---------------------------------------------------------------------------
-- Permisos individuales (asistentes): solo lo que la administración asigna.
create table public.user_permissions (
  user_id uuid not null references auth.users (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  alcance text not null check (alcance in ('global', 'propio')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, permission_id)
);
alter table public.user_permissions enable row level security;

create policy "permisos individuales propios o administración"
  on public.user_permissions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('admin_usuarios')));
create policy "administración asigna permisos individuales a otros"
  on public.user_permissions for insert to authenticated
  with check ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()) and granted_by = (select auth.uid()));
create policy "administración retira permisos individuales"
  on public.user_permissions for delete to authenticated
  using ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()));
create trigger auditar_user_permissions after insert or delete on public.user_permissions
  for each row execute function public.auditar_cambio();

-- El rol de asistente ya no trae permisos: los asigna la administración por persona.
delete from public.role_permissions where role_id = 'consultor';
update public.roles set descripcion = 'Asistente: solo lo que la administración le asigne' where id = 'consultor';
update public.roles set descripcion = 'Cliente: solo lectura de su propio expediente' where id = 'cliente';

create or replace function public.has_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and (
    exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = (select auth.uid()) and rp.permission_id = p
    )
    or exists (
      select 1 from public.user_permissions up
      where up.user_id = (select auth.uid()) and up.permission_id = p
    )
  );
$$;

create or replace function public.has_global_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and (
    exists (
      select 1 from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = (select auth.uid()) and rp.permission_id = p and rp.alcance = 'global'
    )
    or exists (
      select 1 from public.user_permissions up
      where up.user_id = (select auth.uid()) and up.permission_id = p and up.alcance = 'global'
    )
  );
$$;

-- Biblioteca: los clientes no la consultan; el resto según sus permisos.
create or replace function public.niveles_acceso_permitidos()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case
    when not public.es_usuario_activo() then array[]::text[]
    when public.has_perm('admin_fuentes') then array['publico', 'consultores', 'admin']
    when public.has_perm('cargar') then array['publico', 'consultores']
    when exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role_id <> 'cliente')
      or exists (select 1 from public.user_permissions up where up.user_id = (select auth.uid()))
      then array['publico']
    else array[]::text[]
  end;
$$;

-- Generar un PDF crea un documento: exige poder modificar (los clientes solo leen y descargan).
drop policy "registrar documentos generados" on public.documents;
create policy "registrar documentos generados"
  on public.documents for insert to authenticated
  with check (
    (select public.has_case_perm(case_file_id, 'modificar'))
    and created_by = (select auth.uid())
    and (reading_id is null or exists (
      select 1 from public.readings r where r.id = reading_id and r.case_file_id = documents.case_file_id
    ))
  );

-- ---------------------------------------------------------------------------
-- Cambio de contraseña obligatorio.
create function public.exigir_cambio_contrasena(p_user_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.user_profiles p
  set debe_cambiar_contrasena = true,
      huella_contrasena_pendiente = encode(extensions.digest(u.encrypted_password, 'sha256'), 'hex')
  from auth.users u
  where p.user_id = p_user_id and u.id = p_user_id;
  if not found then
    raise exception 'La cuenta no existe' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.exigir_cambio_contrasena(uuid) from public, anon, authenticated;
grant execute on function public.exigir_cambio_contrasena(uuid) to service_role;

-- La persona confirma tras cambiar su contraseña; si el hash no cambió, se rechaza.
create function public.confirmar_cambio_contrasena()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.user_profiles p
  set debe_cambiar_contrasena = false, huella_contrasena_pendiente = null
  from auth.users u
  where p.user_id = (select auth.uid()) and u.id = p.user_id
    and p.debe_cambiar_contrasena
    and (p.huella_contrasena_pendiente is null
         or p.huella_contrasena_pendiente <> encode(extensions.digest(u.encrypted_password, 'sha256'), 'hex'));
  if not found and exists (select 1 from public.user_profiles where user_id = (select auth.uid()) and debe_cambiar_contrasena) then
    raise exception 'La contraseña no cambió' using errcode = 'P0001';
  end if;
end;
$$;
revoke execute on function public.confirmar_cambio_contrasena() from public, anon;
grant execute on function public.confirmar_cambio_contrasena() to authenticated;

-- Inicio de sesión por nombre de usuario: solo el servidor resuelve el correo interno.
create function public.correo_de_usuario(p_username text)
returns text
language sql stable security definer set search_path = ''
as $$
  select u.email from public.user_profiles p join auth.users u on u.id = p.user_id
  where p.username = lower(trim(p_username));
$$;
revoke execute on function public.correo_de_usuario(text) from public, anon, authenticated;
grant execute on function public.correo_de_usuario(text) to service_role;

-- ---------------------------------------------------------------------------
-- Alta inicial con nombre de usuario (el parámetro es opcional para compatibilidad).
drop function public.completar_alta_admin(uuid, text);
create function public.completar_alta_admin(p_user_id uuid, p_display_name text, p_username text default null)
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
  insert into public.user_profiles (user_id, display_name, username) values (p_user_id, p_display_name, lower(p_username))
    on conflict (user_id) do update set display_name = excluded.display_name, username = excluded.username, status = 'activo';
  insert into public.user_roles (user_id, role_id, granted_by) values (p_user_id, 'admin', p_user_id);
  update public.app_setup set completed_at = now(), completed_by = p_user_id where id;
  insert into public.audit_log (actor_id, accion, recurso_tipo, recurso_id)
    values (p_user_id, 'alta_inicial_admin', 'app_setup', 'app_setup');
end;
$$;
revoke execute on function public.completar_alta_admin(uuid, text, text) from public, anon, authenticated;
grant execute on function public.completar_alta_admin(uuid, text, text) to service_role;

-- Resumen de la sesión para la app.
create or replace function public.mi_acceso()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'activo', public.es_usuario_activo(),
    'aal2', public.sesion_aal2(),
    'mfaActivo', exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified'),
    'debeCambiar', coalesce((select p.debe_cambiar_contrasena from public.user_profiles p where p.user_id = (select auth.uid())), false),
    'roles', coalesce((select jsonb_agg(ur.role_id order by ur.role_id) from public.user_roles ur where ur.user_id = (select auth.uid())), '[]'::jsonb),
    'permisos', coalesce((
      select jsonb_agg(distinct x.permiso) from (
        select rp.permission_id as permiso from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
          where ur.user_id = (select auth.uid())
        union
        select up.permission_id from public.user_permissions up where up.user_id = (select auth.uid())
      ) x
      where public.es_usuario_activo()
    ), '[]'::jsonb),
    'estado', (select p.status from public.user_profiles p where p.user_id = (select auth.uid())),
    'nombre', (select p.display_name from public.user_profiles p where p.user_id = (select auth.uid())),
    'usuario', (select p.username from public.user_profiles p where p.user_id = (select auth.uid()))
  );
$$;

revoke all on all tables in schema public from anon;
revoke execute on all functions in schema public from anon;
