-- Purga por retención programada dentro de Supabase: pg_cron llama a diario a la
-- Edge Function purga-retencion (supabase/functions/purga-retencion), que tiene la
-- llave de servicio en su entorno. Sustituye al paso de purga de GitHub Actions.
--
-- Requiere tres secretos en Vault, creados una vez por proyecto (docs/despliegue.md):
--   cn_supabase_url  URL del proyecto
--   cn_anon_key      llave pública (anon), para pasar la verificación JWT de la función
--   cn_purga_token   aleatorio; la función lo compara antes de borrar nada
-- Sin ellos, la tarea corre pero la función responde 401 y no borra.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create or replace function public.purga_token_valido(p_token text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(length(p_token) >= 32 and p_token = (select decrypted_secret from vault.decrypted_secrets where name = 'cn_purga_token'), false);
$$;
revoke execute on function public.purga_token_valido(text) from public, anon, authenticated;
grant execute on function public.purga_token_valido(text) to service_role;

-- 09:17 UTC = 03:17 en Ciudad de México.
select cron.schedule(
  'circulo-nueve-purga',
  '17 9 * * *',
  $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cn_supabase_url') || '/functions/v1/purga-retencion',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cn_anon_key'),
      'x-purga-token', (select decrypted_secret from vault.decrypted_secrets where name = 'cn_purga_token')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
