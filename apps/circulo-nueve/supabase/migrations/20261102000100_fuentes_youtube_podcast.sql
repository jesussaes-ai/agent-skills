-- Fuentes de YouTube (videos y listas), episodios de podcast y audios por enlace,
-- y aprobación automática de versiones (ver docs/biblioteca.md, «Enlaces de YouTube y podcasts»).
-- Estos trabajos siempre los procesa el worker de la DGX Spark (yt-dlp, ffmpeg y Whisper):
-- YouTube bloquea las IP de centros de datos y una función de Vercel no alcanza para transcribir.

alter table public.sources drop constraint if exists sources_origen_check;
alter table public.sources
  add constraint sources_origen_check check (origen in ('archivo', 'web', 'youtube', 'podcast', 'audio-url'));

-- Sin revisión manual: al terminar la extracción, si ningún fragmento parece una instrucción
-- incrustada, el worker aprueba la versión y la indexa. La revisión sigue disponible.
alter table public.sources
  add column if not exists aprobar_automatico boolean not null default true,
  add column if not exists duracion_segundos integer check (duracion_segundos is null or duracion_segundos >= 0),
  add column if not exists canal text check (canal is null or char_length(canal) <= 300);

comment on column public.sources.aprobar_automatico is
  'Si es true, la versión extraída se indexa sin revisión manual salvo que tenga fragmentos sospechosos.';
