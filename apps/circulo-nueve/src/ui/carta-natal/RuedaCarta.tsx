import { SIGNOS, type ResultadoCarta } from "@/modulos/calculo/astrologia";

const SIMBOLOS_SIGNO = ["♈", "♉", "♊", "♋", "♌", "♍", "♎", "♏", "♐", "♑", "♒", "♓"];
const C = 160;

/**
 * Rueda zodiacal de solo lectura. El Ascendente (o 0° Aries si no hay casas)
 * queda a la izquierda. Los puntos inciertos se dibujan como arcos con su rango.
 * La tabla de posiciones es la alternativa accesible.
 */
export function RuedaCarta({ resultado }: { resultado: ResultadoCarta }) {
  const asc = resultado.posiciones.find((p) => p.clave === "asc");
  const giro = asc ? asc.longitud : 0;
  const angulo = (lon: number) => ((180 + lon - giro) * Math.PI) / 180;
  const punto = (lon: number, r: number) => {
    const a = angulo(lon);
    return { x: C + r * Math.cos(a), y: C - r * Math.sin(a) };
  };
  const arco = (desde: number, hasta: number, r: number) => {
    const ancho = (((hasta - desde) % 360) + 360) % 360;
    const p1 = punto(desde, r);
    const p2 = punto(desde + ancho, r);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${ancho > 180 ? 1 : 0} 0 ${p2.x} ${p2.y}`;
  };
  const cuerpos = resultado.posiciones.filter((p) => p.clave !== "asc" && p.clave !== "mc");
  // Separa radialmente los símbolos muy próximos para que no se encimen.
  const ordenados = [...cuerpos].sort((a, b) => a.longitud - b.longitud);
  const radios = new Map<string, number>();
  ordenados.forEach((p, i) => {
    const previo = ordenados[i - 1];
    const cerca = previo && p.longitud - previo.longitud < 7;
    radios.set(p.clave, cerca && radios.get(previo.clave) === 100 ? 82 : 100);
  });

  const resumen = cuerpos.map((p) => `${p.nombre} ${p.texto}`).join("; ");
  return (
    <svg
      viewBox="0 0 320 320"
      role="img"
      aria-label={`Rueda de la carta. ${asc ? `Ascendente ${asc.texto}. ` : "Sin casas: hora desconocida o sin lugar. "}${resumen}.`}
      className="mx-auto h-auto w-full max-w-sm"
    >
      <circle cx={C} cy={C} r={150} className="fill-marino-50 stroke-marino-800" strokeWidth={1.5} />
      <circle cx={C} cy={C} r={124} className="fill-white stroke-marino-300" />
      <circle cx={C} cy={C} r={60} className="fill-marino-50 stroke-marino-200" />
      {SIGNOS.map((nombre, i) => {
        const a = punto(i * 30, 150);
        const b = punto(i * 30, 124);
        const s = punto(i * 30 + 15, 137);
        return (
          <g key={nombre}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-marino-300" />
            <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" className="fill-oro-800 text-[13px]">
              {SIMBOLOS_SIGNO[i]}
            </text>
          </g>
        );
      })}
      {resultado.casas?.cuspides.map((c) => {
        const a = punto(c.longitud, 124);
        const b = punto(c.longitud, 60);
        const n = punto(c.longitud + 4, 68);
        const angular = c.casa === 1 || c.casa === 10 || c.casa === 4 || c.casa === 7;
        return (
          <g key={c.casa}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={angular ? "stroke-marino-800" : "stroke-slate-300"} strokeWidth={angular ? 1.5 : 1} />
            <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central" className="fill-slate-500 text-[8px]">
              {c.casa}
            </text>
          </g>
        );
      })}
      {cuerpos.map((p) => {
        const r = radios.get(p.clave)!;
        const s = punto(p.longitud, r);
        const marca = punto(p.longitud, 122);
        const marcaInt = punto(p.longitud, 116);
        return (
          <g key={p.clave}>
            {p.precision === "rango" ? (
              <path d={arco(p.rango.desde, p.rango.hasta, 119)} className="fill-none stroke-oro-500" strokeWidth={4} strokeLinecap="round" opacity={0.7} />
            ) : (
              <line x1={marca.x} y1={marca.y} x2={marcaInt.x} y2={marcaInt.y} className="stroke-marino-800" strokeWidth={1.5} />
            )}
            <text x={s.x} y={s.y} textAnchor="middle" dominantBaseline="central" className="fill-marino-900 text-[15px]">
              {p.simbolo}
            </text>
          </g>
        );
      })}
      {asc && (
        <text x={C - 140} y={C - 6} className="fill-marino-800 text-[9px] font-semibold">
          AC
        </text>
      )}
    </svg>
  );
}
