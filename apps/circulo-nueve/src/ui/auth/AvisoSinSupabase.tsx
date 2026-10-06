export function AvisoSinSupabase() {
  return (
    <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      Las cuentas no están disponibles en este entorno porque Supabase no está configurado. La demostración de la página de
      inicio sigue funcionando sin cuentas. Para activarlas en local, consulta «Cuentas y Supabase local» en el README.
    </p>
  );
}
