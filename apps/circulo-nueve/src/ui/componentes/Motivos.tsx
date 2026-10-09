/**
 * Motivos decorativos propios de Círculo Nueve, dibujados a mano en SVG.
 * Son solo ornamento: van con aria-hidden y usan currentColor, así que el
 * color y la opacidad los decide quien los coloca.
 */
import type { SVGProps } from "react";

export type Motivo = "emblema" | "numeros" | "rueda" | "arbol" | "constelacion";

type Props = SVGProps<SVGSVGElement>;

/** Redondeo fijo para que el SVG del servidor y el del navegador coincidan. */
const r2 = (n: number) => n.toFixed(2);

const base = (props: Props) => ({
  viewBox: "0 0 200 200",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.4,
  "aria-hidden": true as const,
  focusable: "false" as const,
  ...props,
});

/** Emblema de nueve esferas alrededor de una estrella. */
function Emblema(props: Props) {
  const esferas = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2 - Math.PI / 2;
    return [100 + 70 * Math.cos(a), 100 + 70 * Math.sin(a)] as const;
  });
  return (
    <svg {...base(props)}>
      <circle cx="100" cy="100" r="86" />
      <circle cx="100" cy="100" r="70" strokeDasharray="2 5" />
      {esferas.map(([x, y], i) => (
        <circle key={i} cx={x.toFixed(2)} cy={y.toFixed(2)} r="8" fill="currentColor" fillOpacity="0.35" />
      ))}
      <path d="M100 62 L108 92 L138 100 L108 108 L100 138 L92 108 L62 100 L92 92 Z" fill="currentColor" fillOpacity="0.25" />
    </svg>
  );
}

/** Cuadrado mágico de Lo Shu (cada fila, columna y diagonal suma 15). */
function Numeros(props: Props) {
  const cifras = [2, 7, 6, 9, 5, 1, 4, 3, 8];
  return (
    <svg {...base(props)}>
      <circle cx="100" cy="100" r="90" strokeDasharray="1 6" />
      <rect x="40" y="40" width="120" height="120" rx="6" />
      <path d="M80 40v120M120 40v120M40 80h120M40 120h120" />
      {cifras.map((n, i) => (
        <text
          key={n}
          x={60 + (i % 3) * 40}
          y={68 + Math.floor(i / 3) * 40}
          textAnchor="middle"
          fontSize="24"
          fontFamily="Georgia, 'Times New Roman', serif"
          fill="currentColor"
          stroke="none"
        >
          {n}
        </text>
      ))}
    </svg>
  );
}

/** Rueda zodiacal: doce sectores con un punto por signo. */
function Rueda(props: Props) {
  const radios = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);
  return (
    <svg {...base(props)}>
      <circle cx="100" cy="100" r="92" />
      <circle cx="100" cy="100" r="72" />
      <circle cx="100" cy="100" r="30" strokeDasharray="3 4" />
      {radios.map((a, i) => (
        <g key={i}>
          <line x1={r2(100 + 30 * Math.cos(a))} y1={r2(100 + 30 * Math.sin(a))} x2={r2(100 + 92 * Math.cos(a))} y2={r2(100 + 92 * Math.sin(a))} />
          <circle
            cx={(100 + 82 * Math.cos(a + Math.PI / 12)).toFixed(2)}
            cy={(100 + 82 * Math.sin(a + Math.PI / 12)).toFixed(2)}
            r="3"
            fill="currentColor"
          />
        </g>
      ))}
      <path d="M100 45 L148 128 L52 128 Z" strokeDasharray="1 3" />
    </svg>
  );
}

/** Árbol de la Vida estilizado: diez esferas y sus senderos. */
function Arbol(props: Props) {
  const s: Record<string, [number, number]> = {
    keter: [100, 18],
    jojma: [146, 44],
    bina: [54, 44],
    jesed: [146, 96],
    gevura: [54, 96],
    tiferet: [100, 118],
    netzaj: [146, 148],
    hod: [54, 148],
    yesod: [100, 166],
    maljut: [100, 192],
  };
  const senderos = [
    ["keter", "jojma"], ["keter", "bina"], ["keter", "tiferet"], ["jojma", "bina"], ["jojma", "jesed"],
    ["bina", "gevura"], ["jojma", "tiferet"], ["bina", "tiferet"], ["jesed", "gevura"], ["jesed", "tiferet"],
    ["gevura", "tiferet"], ["jesed", "netzaj"], ["gevura", "hod"], ["tiferet", "netzaj"], ["tiferet", "hod"],
    ["tiferet", "yesod"], ["netzaj", "hod"], ["netzaj", "yesod"], ["hod", "yesod"], ["netzaj", "maljut"],
    ["hod", "maljut"], ["yesod", "maljut"],
  ];
  return (
    <svg {...base(props)} viewBox="0 0 200 210">
      {senderos.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={s[a][0]} y1={s[a][1]} x2={s[b][0]} y2={s[b][1]} />
      ))}
      {Object.entries(s).map(([k, [x, y]]) => (
        <circle key={k} cx={x} cy={y} r="10" fill="currentColor" fillOpacity="0.3" />
      ))}
    </svg>
  );
}

/** Constelación: estrellas unidas por líneas finas. */
function Constelacion(props: Props) {
  const e: [number, number, number][] = [
    [30, 150, 3], [62, 118, 2.5], [96, 128, 4], [120, 92, 2.5], [150, 70, 3.5], [172, 34, 2.5], [138, 140, 2], [176, 160, 3], [70, 50, 2], [40, 70, 1.5],
  ];
  const lineas = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [2, 6], [6, 7], [3, 8], [8, 9]];
  return (
    <svg {...base(props)}>
      {lineas.map(([a, b]) => (
        <line key={`${a}-${b}`} x1={e[a][0]} y1={e[a][1]} x2={e[b][0]} y2={e[b][1]} strokeDasharray="2 3" />
      ))}
      {e.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} fill="currentColor" />
          {r >= 3 && <path d={`M${x - r * 2.4} ${y}H${x + r * 2.4}M${x} ${y - r * 2.4}V${y + r * 2.4}`} strokeWidth="0.8" />}
        </g>
      ))}
    </svg>
  );
}

const MOTIVOS: Record<Motivo, (p: Props) => React.JSX.Element> = {
  emblema: Emblema,
  numeros: Numeros,
  rueda: Rueda,
  arbol: Arbol,
  constelacion: Constelacion,
};

export function DibujoMotivo({ motivo, ...props }: Props & { motivo: Motivo }) {
  const Dibujo = MOTIVOS[motivo];
  return <Dibujo {...props} />;
}

/** Elige el motivo según la sección de ayuda a la que pertenece una tarjeta. */
export function motivoDeSeccion(ayuda: string): Motivo {
  if (/carta-natal/.test(ayuda)) return "rueda";
  if (/cabala/.test(ayuda)) return "arbol";
  if (/biblioteca|asistente|proveedores/.test(ayuda)) return "constelacion";
  if (/numerologia|lecturas|perfil|consentimiento/.test(ayuda)) return "numeros";
  return "emblema";
}
