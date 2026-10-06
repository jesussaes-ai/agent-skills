-- Círculo Nueve · El bot de la biblioteca usa la misma capa de proveedores LLM
-- que el asistente; su consumo se registra (sin prompts) con origen «biblioteca».
alter table public.ai_usage drop constraint ai_usage_origen_check;
alter table public.ai_usage
  add constraint ai_usage_origen_check check (origen in ('asistente-ayuda', 'prueba-admin', 'biblioteca'));
