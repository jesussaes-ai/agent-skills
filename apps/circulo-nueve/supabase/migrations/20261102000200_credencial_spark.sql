-- Credencial del worker de la DGX Spark (ver docs/biblioteca.md, «Worker en la DGX Spark»).
-- La Spark guarda un secreto aleatorio; aquí solo vive su huella SHA-256. La Edge Function
-- `credencial-spark` compara la huella y entrega un JWT de servicio que caduca en 6 horas,
-- así la llave de servicio del proyecto nunca sale de Supabase.

create table if not exists public.worker_credenciales (
  nombre text primary key check (nombre ~ '^[a-z0-9-]{3,40}$'),
  huella_sha256 text not null check (huella_sha256 ~ '^[0-9a-f]{64}$'),
  activa boolean not null default true,
  creada_at timestamptz not null default now(),
  ultimo_uso_at timestamptz
);

-- Sin políticas: ni anon ni authenticated pueden leerla; solo la llave de servicio.
alter table public.worker_credenciales enable row level security;
revoke all on public.worker_credenciales from anon, authenticated;
