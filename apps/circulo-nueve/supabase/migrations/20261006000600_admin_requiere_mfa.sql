-- Círculo Nueve · Los permisos que vienen del rol admin solo valen con una
-- sesión verificada en dos pasos (aal2). Así, una contraseña robada no basta
-- para administrar, aunque la app tuviera un fallo.

create function public.sesion_aal2()
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2';
$$;
revoke execute on function public.sesion_aal2() from public, anon;
grant execute on function public.sesion_aal2() to authenticated, service_role;

create or replace function public.has_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select auth.uid())
      and rp.permission_id = p
      and (ur.role_id <> 'admin' or public.sesion_aal2())
  );
$$;

create or replace function public.has_global_perm(p text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.es_usuario_activo() and exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_id = ur.role_id
    where ur.user_id = (select auth.uid())
      and rp.permission_id = p
      and rp.alcance = 'global'
      and (ur.role_id <> 'admin' or public.sesion_aal2())
  );
$$;

-- Resumen de la sesión para la app: roles y permisos efectivos de quien llama.
create function public.mi_acceso()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'activo', public.es_usuario_activo(),
    'aal2', public.sesion_aal2(),
    'roles', coalesce((select jsonb_agg(ur.role_id order by ur.role_id) from public.user_roles ur where ur.user_id = (select auth.uid())), '[]'::jsonb),
    'permisos', coalesce((
      select jsonb_agg(distinct rp.permission_id)
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = (select auth.uid())
        and public.es_usuario_activo()
        and (ur.role_id <> 'admin' or public.sesion_aal2())
    ), '[]'::jsonb),
    'estado', (select p.status from public.user_profiles p where p.user_id = (select auth.uid())),
    'nombre', (select p.display_name from public.user_profiles p where p.user_id = (select auth.uid()))
  );
$$;
revoke execute on function public.mi_acceso() from public, anon;
grant execute on function public.mi_acceso() to authenticated;

-- Auditoría también de cuentas y roles (estado y rol, nunca datos personales).
create or replace function public.auditar_cambio()
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
    case tg_table_name
      when 'case_file_grants' then jsonb_build_object('usuario', fila ->> 'user_id', 'permisos', fila -> 'permissions')
      when 'user_roles' then jsonb_build_object('rol', fila ->> 'role_id')
      when 'user_profiles' then jsonb_build_object('estado', fila ->> 'status')
      else '{}'::jsonb
    end
  );
  return coalesce(new, old);
end;
$$;
revoke execute on function public.auditar_cambio() from public, anon, authenticated;

create trigger auditar_user_profiles after insert or update of status or delete on public.user_profiles
  for each row execute function public.auditar_cambio();
create trigger auditar_user_roles after insert or delete on public.user_roles
  for each row execute function public.auditar_cambio();
