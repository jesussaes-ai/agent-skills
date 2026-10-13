-- Círculo Nueve · Configuración de proveedores LLM editable por la administración.
-- La tabla guarda el NOMBRE del secreto (prefijo LLM_KEY_), nunca la llave.
-- El registro de consumo no tiene columnas para prompts ni respuestas.

alter table public.ai_providers
  add column tipo text not null default 'openai_compatible'
    check (tipo in ('openrouter', 'freellmapi', 'openai_compatible')),
  add column modelos_alternos text[] not null default '{}',
  add column destinatarios text not null default '',
  add column politica jsonb not null default '{}'::jsonb,
  add column limites jsonb not null default '{}'::jsonb,
  add column costo jsonb not null default '{}'::jsonb,
  add column prioridad integer not null default 100 check (prioridad between 0 and 1000),
  add constraint ai_providers_id_formato check (id ~ '^[a-z0-9][a-z0-9-]{1,39}$' and id <> 'entorno'),
  add constraint ai_providers_secreto_formato check (secreto_nombre is null or secreto_nombre ~ '^LLM_KEY_[A-Z0-9_]{1,40}$'),
  add constraint ai_providers_endpoint_formato check (endpoint ~ '^https?://[^/?#@]+'),
  add constraint ai_providers_alternos_max check (cardinality(modelos_alternos) <= 5),
  -- Defensa en la base: lo gratuito y FreeLLMAPI nunca se marcan aptos para datos reales.
  add constraint ai_providers_gratuito_solo_demo check (
    not permite_datos_reales or (
      tipo <> 'freellmapi'
      and modelo !~ ':free$' and modelo <> 'openrouter/free'
      and array_to_string(modelos_alternos, ',') !~ '(:free|openrouter/free)(,|$)'
    )
  );
alter table public.ai_providers alter column endpoint set not null;

create policy "administración de proveedores crea proveedores"
  on public.ai_providers for insert to authenticated with check ((select public.has_perm('admin_proveedores')));
create policy "administración de proveedores borra proveedores"
  on public.ai_providers for delete to authenticated using ((select public.has_perm('admin_proveedores')));

create trigger auditar_ai_providers after insert or update or delete on public.ai_providers
  for each row execute function public.auditar_cambio();

alter table public.ai_usage
  add column intento smallint not null default 1 check (intento between 0 and 10),
  add column latencia_ms integer check (latencia_ms >= 0),
  add column origen text not null default 'asistente-ayuda' check (origen in ('asistente-ayuda', 'prueba-admin')),
  add constraint ai_usage_codigo check (codigo_resultado in (
    'ok', 'limite_429', 'servidor', 'tiempo', 'red', 'autorizacion', 'credito',
    'solicitud', 'respuesta_invalida', 'sin_llave', 'limite_local'
  ));
create index ai_usage_proveedor_fecha_idx on public.ai_usage (provider_id, created_at desc);

-- Uso actual para aplicar límites; lo llama el servidor con la llave de servicio.
create function public.ai_uso_actual(p_provider text)
returns table (ultimo_minuto integer, hoy integer, gasto_mes_usd numeric)
language sql stable security definer set search_path = ''
as $$
  select
    count(*) filter (where created_at > now() - interval '1 minute')::integer,
    count(*) filter (where created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc')::integer,
    coalesce(sum(costo_estimado_usd), 0)
  from public.ai_usage
  where provider_id = p_provider
    and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc';
$$;
revoke execute on function public.ai_uso_actual(text) from public, anon, authenticated;
grant execute on function public.ai_uso_actual(text) to service_role;
