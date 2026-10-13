-- fijar_retencion_documento() es una función de trigger: Postgres no la ejecuta fuera
-- de un trigger, pero quedaba expuesta en /rest/v1/rpc al rol anónimo (asesor 0028).
-- El privilegio EXECUTE solo se comprueba al crear el trigger, así que retirarlo no lo afecta.
revoke execute on function public.fijar_retencion_documento() from public, anon, authenticated;
