import type {
  ClaveAspecto,
  ClaveAyanamsa,
  ClaveCuerpo,
  ConfigAspecto,
  ConfigAstrologia,
  SistemaCasas,
  SistemaRespaldoPolar,
} from "./tipos";

export const MOTOR = "circulo-nueve/astrologia";
export const MOTOR_VERSION = "1.0.0";
export const REGLAS_VERSION = "carta-natal-2026.10";
export const EFEMERIDES = "astronomy-engine 2.1.19 (MIT, Don Cross)";
/**
 * Diferencia máxima medida contra Swiss Ephemeris 2.10.03 (1900–2050): 18″
 * (Neptuno). Se redondea a 30″ como piso de incertidumbre de toda posición.
 */
export const EXACTITUD_MOTOR_GRADOS = 30 / 3600;

export const SIGNOS = [
  "Aries",
  "Tauro",
  "Géminis",
  "Cáncer",
  "Leo",
  "Virgo",
  "Libra",
  "Escorpio",
  "Sagitario",
  "Capricornio",
  "Acuario",
  "Piscis",
] as const;

export const CUERPOS: { clave: ClaveCuerpo; nombre: string; simbolo: string }[] = [
  { clave: "sol", nombre: "Sol", simbolo: "☉" },
  { clave: "luna", nombre: "Luna", simbolo: "☽" },
  { clave: "mercurio", nombre: "Mercurio", simbolo: "☿" },
  { clave: "venus", nombre: "Venus", simbolo: "♀" },
  { clave: "marte", nombre: "Marte", simbolo: "♂" },
  { clave: "jupiter", nombre: "Júpiter", simbolo: "♃" },
  { clave: "saturno", nombre: "Saturno", simbolo: "♄" },
  { clave: "urano", nombre: "Urano", simbolo: "♅" },
  { clave: "neptuno", nombre: "Neptuno", simbolo: "♆" },
  { clave: "pluton", nombre: "Plutón", simbolo: "♇" },
  { clave: "nodo", nombre: "Nodo norte", simbolo: "☊" },
];

export const PUNTOS_ANGULARES = [
  { clave: "asc", nombre: "Ascendente", simbolo: "AC" },
  { clave: "mc", nombre: "Medio Cielo", simbolo: "MC" },
] as const;

export const ASPECTOS: Record<ClaveAspecto, { nombre: string; angulo: number; mayor: boolean }> = {
  conjuncion: { nombre: "Conjunción", angulo: 0, mayor: true },
  oposicion: { nombre: "Oposición", angulo: 180, mayor: true },
  trigono: { nombre: "Trígono", angulo: 120, mayor: true },
  cuadratura: { nombre: "Cuadratura", angulo: 90, mayor: true },
  sextil: { nombre: "Sextil", angulo: 60, mayor: true },
  semisextil: { nombre: "Semisextil", angulo: 30, mayor: false },
  quincuncio: { nombre: "Quincuncio", angulo: 150, mayor: false },
  semicuadratura: { nombre: "Semicuadratura", angulo: 45, mayor: false },
  sesquicuadratura: { nombre: "Sesquicuadratura", angulo: 135, mayor: false },
};

export const ASPECTOS_POR_DEFECTO: ConfigAspecto[] = [
  { clave: "conjuncion", activo: true, orbe: 8 },
  { clave: "oposicion", activo: true, orbe: 8 },
  { clave: "trigono", activo: true, orbe: 7 },
  { clave: "cuadratura", activo: true, orbe: 7 },
  { clave: "sextil", activo: true, orbe: 5 },
  { clave: "semisextil", activo: false, orbe: 2 },
  { clave: "quincuncio", activo: false, orbe: 3 },
  { clave: "semicuadratura", activo: false, orbe: 2 },
  { clave: "sesquicuadratura", activo: false, orbe: 2 },
];

export const NOMBRES_SISTEMA_CASAS: Record<SistemaCasas, string> = {
  placidus: "Placidus",
  koch: "Koch",
  regiomontano: "Regiomontano",
  campano: "Campano",
  porfirio: "Porfirio",
  iguales: "Casas iguales (desde el Ascendente)",
  "signos-enteros": "Signos enteros",
};

export const SISTEMAS_RESPALDO: SistemaRespaldoPolar[] = ["porfirio", "iguales", "signos-enteros"];

export const NOMBRES_AYANAMSA: Record<ClaveAyanamsa, string> = {
  lahiri: "Lahiri (Chitrapaksha)",
  "fagan-bradley": "Fagan-Bradley",
  raman: "B. V. Raman",
  krishnamurti: "Krishnamurti (KP)",
};

export const CONFIG_POR_DEFECTO: ConfigAstrologia = {
  zodiaco: "tropical",
  ayanamsa: "lahiri",
  sistemaCasas: "placidus",
  respaldoPolar: "porfirio",
  nodo: "verdadero",
  aspectos: ASPECTOS_POR_DEFECTO,
  margenExactaMin: 1,
  margenAproximadaMin: 30,
};

export function crearConfig(parcial: Partial<ConfigAstrologia> = {}): ConfigAstrologia {
  const config = { ...CONFIG_POR_DEFECTO, ...parcial };
  const porClave = new Map((parcial.aspectos ?? []).map((a) => [a.clave, a]));
  config.aspectos = ASPECTOS_POR_DEFECTO.map((a) => ({ ...a, ...porClave.get(a.clave) }));
  return config;
}
