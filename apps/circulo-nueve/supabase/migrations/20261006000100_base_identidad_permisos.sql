-- Circulo Nueve · Base: extensiones, identidad, roles y permisos.
-- Principio: RLS activado en todas las tablas de public; sin política, se deniega.
-- Los permisos se comprueban consultando tablas (no solo el JWT), para que una
-- suspensión o un cambio de rol tenga efecto inmediato.

create extension if not exists vector with schema extensions;
create extension if not exists unaccent with schema extensions;

-- El rol anónimo no recibe privilegios sobre tablas nuevas de public.
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from anon, public;

-- ---------------------------------------------------------------------------
-- Alta inicial (fila única). Solo la usa el servidor con service role.
create table public.app_setup (
  id boolean primary key default true check (id),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null
);
insert into public.app_setup (id) values (true);
alter table public.app_setup enable row level security;

-- ---------------------------------------------------------------------------
create table public.user_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  status text not null default 'activo' check (status in ('activo', 'suspendido', 'revocado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_profiles enable row level security;

create table public.permissions (
  id text primary key,
  descripcion text not null
);
alter table public.permissions enable row level security;

create table public.roles (
  id text primary key,
  descripcion text not null
);
alter table public.roles enable row level security;

-- alcance 'global': el permiso aplica a todos los expedientes.
-- alcance 'propio': solo a expedientes creados por el usuario o asignados.
create table public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  alcance text not null check (alcance in ('global', 'propio')),
  primary key (role_id, permission_id)
);
alter table public.role_permissions enable row level security;

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id text not null references public.roles (id) on delete restrict,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  primary key (user_id, role_id)
);
alter table public.user_roles enable row level security;

insert into public.permissions (id, descripcion) values
  ('listar', 'Ver y listar'),
  ('abrir_descargar', 'Abrir y descargar'),
  ('cargar', 'Cargar y crear'),
  ('modificar', 'Modificar'),
  ('borrar', 'Borrar'),
  ('compartir', 'Compartir archivos o expedientes'),
  ('admin_usuarios', 'Administrar usuarios, roles y asignaciones'),
  ('admin_fuentes', 'Administrar la biblioteca de fuentes'),
  ('admin_proveedores', 'Administrar proveedores de IA');

insert into public.roles (id, descripcion) values
  ('admin', 'Administrador de la aplicación'),
  ('consultor', 'Practicante que gestiona sus propios expedientes'),
  ('cliente', 'Persona que solo ve su propio expediente');

insert into public.role_permissions (role_id, permission_id, alcance)
select 'admin', id, 'global' from public.permissions;

insert into public.role_permissions (role_id, permission_id, alcance) values
  ('consultor', 'listar', 'propio'),
  ('consultor', 'abrir_descargar', 'propio'),
  ('consultor', 'cargar', 'propio'),
  ('consultor', 'modificar', 'propio'),
  ('consultor', 'borrar', 'propio'),
  ('consultor', 'compartir', 'propio');

-- ---------------------------------------------------------------------------
-- Funciones de autorización. security definer + search_path vacío.

create function public.es_usuario_activo()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.user_id = (select auth.uid()) and p.status = 'activo'
  );
$$;

create function public.has_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select auth.uid()) and rp.permission_id = p
  );
$$;

create function public.has_global_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select auth.uid()) and rp.permission_id = p and rp.alcance = 'global'
  );
$$;

revoke execute on function public.es_usuario_activo() from public, anon;
revoke execute on function public.has_perm(text) from public, anon;
revoke execute on function public.has_global_perm(text) from public, anon;
grant execute on function public.es_usuario_activo() to authenticated, service_role;
grant execute on function public.has_perm(text) to authenticated, service_role;
grant execute on function public.has_global_perm(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Políticas

create policy "perfil propio o administración"
  on public.user_profiles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('admin_usuarios')));

create policy "solo administración crea perfiles"
  on public.user_profiles for insert to authenticated
  with check ((select public.has_perm('admin_usuarios')));

-- Un administrador no puede cambiar su propio estado (evita bloquearse o reactivarse).
create policy "solo administración modifica perfiles ajenos"
  on public.user_profiles for update to authenticated
  using ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()))
  with check ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()));

create policy "catálogo de permisos legible"
  on public.permissions for select to authenticated using (true);

create policy "catálogo de roles legible"
  on public.roles for select to authenticated using (true);

create policy "permisos por rol legibles"
  on public.role_permissions for select to authenticated using (true);

create policy "roles propios o administración"
  on public.user_roles for select to authenticated
  using (user_id = (select auth.uid()) or (select public.has_perm('admin_usuarios')));

-- Nadie se autoasigna ni se quita roles, ni siquiera un administrador.
create policy "administración asigna roles a otros"
  on public.user_roles for insert to authenticated
  with check (
    (select public.has_perm('admin_usuarios'))
    and user_id <> (select auth.uid())
    and granted_by = (select auth.uid())
  );

create policy "administración retira roles a otros"
  on public.user_roles for delete to authenticated
  using ((select public.has_perm('admin_usuarios')) and user_id <> (select auth.uid()));

create function public.tocar_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_profiles_updated_at
  before update on public.user_profiles
  for each row execute function public.tocar_updated_at();
