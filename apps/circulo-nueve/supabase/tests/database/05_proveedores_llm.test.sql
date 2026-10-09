-- Proveedores LLM: solo la administración (con MFA) los edita, la base rechaza
-- secretos fuera del prefijo y datos reales en modelos gratuitos, y el consumo
-- no tiene dónde guardar prompts.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@demo.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'consultor@demo.invalid', 'authenticated', 'authenticated');
select public.completar_alta_admin('00000000-0000-0000-0000-00000000000a', 'Admin demo');
insert into public.user_profiles (user_id, display_name) values ('00000000-0000-0000-0000-0000000000b1', 'Consultor demo');
insert into public.user_roles (user_id, role_id) values ('00000000-0000-0000-0000-0000000000b1', 'consultor');
insert into public.user_permissions (user_id, permission_id, alcance)
  select ur.user_id, p, 'propio' from public.user_roles ur,
    unnest(array['listar', 'abrir_descargar', 'cargar', 'modificar', 'borrar', 'compartir']) as p
  where ur.role_id = 'consultor';

select hasnt_column('public', 'ai_usage', 'prompt', 'el consumo no tiene columna para el prompt');
select hasnt_column('public', 'ai_usage', 'respuesta', 'el consumo no tiene columna para la respuesta');

select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo, secreto_nombre)
    values ('malo', 'Malo', 'https://x.invalid/v1', 'm', 'SUPABASE_SERVICE_ROLE_KEY')$$,
  '23514', null, 'rechaza secretos sin el prefijo LLM_KEY_'
);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo, tipo, permite_datos_reales)
    values ('gratis', 'Gratis', 'https://openrouter.ai/api/v1', 'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter', true)$$,
  '23514', null, 'un modelo gratuito no puede marcarse apto para datos reales'
);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo, tipo, permite_datos_reales, modelos_alternos)
    values ('alterno', 'Alterno', 'https://openrouter.ai/api/v1', 'deepseek/deepseek-v4-flash', 'openrouter', true, '{nvidia/nemotron-3.5-lightning:free}')$$,
  '23514', null, 'tampoco con un respaldo gratuito'
);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo, tipo, permite_datos_reales)
    values ('fl', 'FreeLLMAPI', 'http://127.0.0.1:3001/v1', 'auto', 'freellmapi', true)$$,
  '23514', null, 'FreeLLMAPI no puede marcarse apto para datos reales'
);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo) values ('entorno', 'X', 'https://x.invalid/v1', 'm')$$,
  '23514', null, 'el id «entorno» está reservado'
);

-- Consultor: no ve ni crea proveedores.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo) values ('intruso', 'X', 'https://x.invalid/v1', 'm')$$,
  '42501', null, 'quien no administra proveedores no puede crearlos'
);

-- Admin con MFA activada pero sesión aal1: tampoco.
reset role;
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
  select gen_random_uuid(), '00000000-0000-0000-0000-00000000000a', 'demo', 'totp', 'verified', now(), now();
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo) values ('sin-mfa', 'X', 'https://x.invalid/v1', 'm')$$,
  '42501', null, 'la administración con verificación activada y sesión aal1 no puede crearlos'
);

-- Admin con MFA: sí, y queda auditado.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated","aal":"aal2"}', true);
select lives_ok(
  $$insert into public.ai_providers (id, nombre, endpoint, modelo, tipo, secreto_nombre)
    values ('openrouter-demo', 'OpenRouter demo', 'https://openrouter.ai/api/v1', 'nvidia/nemotron-3-super-120b-a12b:free', 'openrouter', 'LLM_KEY_OPENROUTER')$$,
  'la administración con MFA crea un proveedor'
);
select lives_ok($$delete from public.ai_providers where id = 'openrouter-demo'$$, 'y lo borra');
select throws_ok($$select * from public.ai_uso_actual('openrouter-demo')$$, '42501', null, 'el uso actual solo lo consulta el servidor');
reset role;

select is(
  (select count(*) from public.audit_log where recurso_tipo = 'ai_providers' and recurso_id = 'openrouter-demo'),
  2::bigint,
  'alta y baja del proveedor quedan auditadas'
);

insert into public.ai_providers (id, nombre, endpoint, modelo) values ('local', 'Local', 'http://127.0.0.1:11434/v1', 'm');
insert into public.ai_usage (provider_id, modelo, codigo_resultado, costo_estimado_usd) values ('local', 'm', 'ok', 0.5), ('local', 'm', 'limite_429', null);
select results_eq(
  $$select ultimo_minuto, hoy, gasto_mes_usd from public.ai_uso_actual('local')$$,
  $$values (2, 2, 0.5::numeric)$$,
  'ai_uso_actual cuenta solicitudes y gasto del mes'
);

select * from finish();
rollback;
