-- La auditoría es de solo inserción incluso para el propietario de la base
-- y no guarda contenido de los expedientes.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.case_files (id, display_label, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Expediente demo', '00000000-0000-0000-0000-00000000000a');
insert into public.birth_profiles (case_file_id, birth_name)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'Nombre Ficticio Secreto');

select ok((select count(*) from public.audit_log) >= 3, 'el alta y los cambios quedan auditados');
select is(
  (select count(*) from public.audit_log where detalle::text ilike '%Ficticio%'),
  0::bigint,
  'la auditoría no copia datos personales'
);
select throws_ok('update public.audit_log set accion = $$x$$', 'P0001', 'audit_log es de solo inserción', 'no se modifica la auditoría');
select throws_ok('delete from public.audit_log', 'P0001', 'audit_log es de solo inserción', 'no se borra la auditoría');

select * from finish();
rollback;
