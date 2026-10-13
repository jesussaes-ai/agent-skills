// Genera src/modulos/calculo/astrologia/casos-referencia.json con una fuente
// independiente del motor de la app:
//   - Posiciones, nodos, ayanamsas y casas: Swiss Ephemeris (binding `sweph`,
//     AGPL-3.0) con los archivos de efemérides sepl_18/semo_18 de
//     github.com/aloistr/swisseph/ephe.
//   - Hora local → UT: Python `zoneinfo` con la tzdb del sistema operativo.
// Solo se publican los números resultantes; sweph no se distribuye con la app.
//
// Uso: SE_EPHE_PATH=/ruta/a/ephe npm run generar
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const sweph = require("sweph");
const C = sweph.constants;
const rutaEfemerides = process.env.SE_EPHE_PATH;
if (!rutaEfemerides) throw new Error("Define SE_EPHE_PATH con la carpeta de archivos .se1 de Swiss Ephemeris.");
sweph.set_ephe_path(rutaEfemerides);

const CUERPOS = {
  sol: C.SE_SUN, luna: C.SE_MOON, mercurio: C.SE_MERCURY, venus: C.SE_VENUS, marte: C.SE_MARS,
  jupiter: C.SE_JUPITER, saturno: C.SE_SATURN, urano: C.SE_URANUS, neptuno: C.SE_NEPTUNE, pluton: C.SE_PLUTO,
  nodoMedio: C.SE_MEAN_NODE, nodoVerdadero: C.SE_TRUE_NODE,
};
const SISTEMAS = { placidus: "P", koch: "K", regiomontano: "R", campano: "C", porfirio: "O", iguales: "E", "signos-enteros": "W" };
const AYANAMSAS = { lahiri: C.SE_SIDM_LAHIRI, "fagan-bradley": C.SE_SIDM_FAGAN_BRADLEY, raman: C.SE_SIDM_RAMAN, krishnamurti: C.SE_SIDM_KRISHNAMURTI };

// Coordenadas y zona horaria tomadas de GeoNames (cities15000, CC BY 4.0).
const LUGARES = {
  cdmx: { nombre: "Mexico City, MX", geonameId: 3530597, latitud: 19.42847, longitud: -99.12766, zonaHoraria: "America/Mexico_City" },
  tijuana: { nombre: "Tijuana, MX", geonameId: 3981609, latitud: 32.5027, longitud: -117.00371, zonaHoraria: "America/Tijuana" },
  cancun: { nombre: "Cancún, MX", geonameId: 3531673, latitud: 21.17429, longitud: -86.84656, zonaHoraria: "America/Cancun" },
  hermosillo: { nombre: "Hermosillo, MX", geonameId: 4004898, latitud: 29.08874, longitud: -110.96677, zonaHoraria: "America/Hermosillo" },
  guadalajara: { nombre: "Guadalajara, MX", geonameId: 4005539, latitud: 20.67738, longitud: -103.34749, zonaHoraria: "America/Mexico_City" },
  buenosAires: { nombre: "Buenos Aires, AR", geonameId: 3435910, latitud: -34.61315, longitud: -58.37723, zonaHoraria: "America/Argentina/Buenos_Aires" },
  tromso: { nombre: "Tromsø, NO", geonameId: 3133895, latitud: 69.6489, longitud: 18.95508, zonaHoraria: "Europe/Oslo" },
  reykjavik: { nombre: "Reykjavík, IS", geonameId: 3413829, latitud: 64.13548, longitud: -21.89541, zonaHoraria: "Atlantic/Reykjavik" },
  madrid: { nombre: "Madrid, ES", geonameId: 3117735, latitud: 40.4165, longitud: -3.70256, zonaHoraria: "Europe/Madrid" },
  kolkata: { nombre: "Kolkata, IN", geonameId: 1275004, latitud: 22.56263, longitud: 88.36304, zonaHoraria: "Asia/Kolkata" },
  sydney: { nombre: "Sydney, AU", geonameId: 2147714, latitud: -33.86785, longitud: 151.20732, zonaHoraria: "Australia/Sydney" },
  // Complejo de lanzamiento 39A (NASA); no está en GeoNames cities15000.
  ksc39a: { nombre: "Kennedy Space Center LC-39A, US", latitud: 28.60822, longitud: -80.60428, zonaHoraria: "America/New_York" },
};

/** Casos con personas ficticias (marcadas como demostración) y eventos públicos. */
const CASOS = [
  { id: "ana-demo", titulo: "Persona ficticia de la demo (Ana), Ciudad de México", lugar: "cdmx", fecha: "1990-07-15", hora: "08:30", ficticio: true },
  { id: "tijuana-verano", titulo: "Persona ficticia, Tijuana en horario de verano (PDT)", lugar: "tijuana", fecha: "2015-07-04", hora: "14:05", ficticio: true },
  { id: "cancun-2016", titulo: "Persona ficticia, Cancún tras el cambio de 2015 a UTC−5", lugar: "cancun", fecha: "2016-01-10", hora: "23:40", ficticio: true },
  { id: "hermosillo", titulo: "Persona ficticia, Hermosillo (sin horario de verano)", lugar: "hermosillo", fecha: "1999-06-01", hora: "06:15", ficticio: true },
  { id: "cdmx-2023", titulo: "Persona ficticia, Ciudad de México tras abolir el horario de verano (2022)", lugar: "cdmx", fecha: "2023-06-15", hora: "12:00", ficticio: true },
  { id: "guadalajara-1950", titulo: "Persona ficticia, Guadalajara 1950 (anterior a 1970)", lugar: "guadalajara", fecha: "1950-03-21", hora: "05:45", ficticio: true },
  { id: "buenos-aires", titulo: "Persona ficticia, Buenos Aires (hemisferio sur)", lugar: "buenosAires", fecha: "1985-11-30", hora: "03:20", ficticio: true },
  { id: "sydney", titulo: "Persona ficticia, Sídney en horario de verano austral", lugar: "sydney", fecha: "2004-01-20", hora: "16:45", ficticio: true },
  { id: "reykjavik", titulo: "Persona ficticia, Reikiavik (64° N, Placidus aún definido)", lugar: "reykjavik", fecha: "1978-05-02", hora: "21:10", ficticio: true },
  { id: "tromso-polar", titulo: "Persona ficticia, Tromsø (69,6° N, dentro del círculo polar)", lugar: "tromso", fecha: "1995-12-21", hora: "10:00", ficticio: true },
  { id: "kolkata-sideral", titulo: "Persona ficticia, Calcuta (casos siderales)", lugar: "kolkata", fecha: "1975-02-14", hora: "18:10", ficticio: true },
  { id: "sismo-1985", titulo: "Evento público: sismo de México, 19 sep 1985, 07:17:47 hora local (USGS: 13:17:47 UTC)", lugar: "cdmx", fecha: "1985-09-19", hora: "07:17:47", ficticio: false },
  { id: "apolo-11", titulo: "Evento público: lanzamiento del Apolo 11, 16 jul 1969, 09:32 EDT (NASA: 13:32 UTC)", lugar: "ksc39a", fecha: "1969-07-16", hora: "09:32", ficticio: false },
];

/** Casos de zona horaria (hora repetida o inexistente), solo conversión. */
const CASOS_ZONA = [
  { id: "madrid-repetida", titulo: "Madrid, 29 oct 2000 02:30: hora repetida al terminar el horario de verano", zonaHoraria: "Europe/Madrid", fecha: "2000-10-29", hora: "02:30" },
  { id: "cdmx-inexistente", titulo: "Ciudad de México, 7 abr 2002 02:30: hora inexistente al iniciar el horario de verano", zonaHoraria: "America/Mexico_City", fecha: "2002-04-07", hora: "02:30" },
  { id: "cdmx-1900-lmt", titulo: "Ciudad de México, 1900: hora media local (LMT) antes de la hora estándar", zonaHoraria: "America/Mexico_City", fecha: "1900-01-01", hora: "12:00" },
  { id: "cdmx-1931", titulo: "Ciudad de México, diciembre 1931 (desfase histórico según tzdb)", zonaHoraria: "America/Mexico_City", fecha: "1931-12-01", hora: "12:00" },
  { id: "cdmx-1932", titulo: "Ciudad de México, junio 1932 (desfase histórico según tzdb)", zonaHoraria: "America/Mexico_City", fecha: "1932-06-01", hora: "12:00" },
  { id: "cdmx-verano-2010", titulo: "Ciudad de México, julio 2010 (horario de verano, UTC−5)", zonaHoraria: "America/Mexico_City", fecha: "2010-07-01", hora: "12:00" },
  { id: "chihuahua-2023", titulo: "Chihuahua, julio 2023 (UTC−6 fijo desde el 30 oct 2022)", zonaHoraria: "America/Chihuahua", fecha: "2023-07-01", hora: "12:00" },
  { id: "juarez-invierno-2023", titulo: "Ciudad Juárez, enero 2023 (sigue el horario de EE. UU.: MST, UTC−7)", zonaHoraria: "America/Ciudad_Juarez", fecha: "2023-01-15", hora: "12:00" },
];

const PY = `
import json, sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
salida = []
for c in json.loads(sys.argv[1]):
    h = [int(x) for x in c["hora"].split(":")] + [0]
    y, m, d = [int(x) for x in c["fecha"].split("-")]
    tz = ZoneInfo(c["zonaHoraria"])
    res = []
    for fold in (0, 1):
        loc = datetime(y, m, d, h[0], h[1], h[2], tzinfo=tz, fold=fold)
        utc = loc.astimezone(timezone.utc)
        vuelta = utc.astimezone(tz).replace(tzinfo=None)
        res.append({"fold": fold, "utc": utc.strftime("%Y-%m-%dT%H:%M:%SZ"), "desfaseSeg": int(loc.utcoffset().total_seconds()),
                    "existe": vuelta == loc.replace(tzinfo=None)})
    salida.append({"id": c["id"], "candidatos": res})
import pathlib
ver = pathlib.Path("/usr/share/zoneinfo/tzdata.zi").read_text().splitlines()[0].replace("# version ", "") if pathlib.Path("/usr/share/zoneinfo/tzdata.zi").exists() else "desconocida"
print(json.dumps({"tzdb": ver, "casos": salida}))
`;

function zonas(lista) {
  const out = execFileSync("python3", ["-c", PY, JSON.stringify(lista)], { encoding: "utf8" });
  return JSON.parse(out);
}

/** Interpreta lo que devuelve zoneinfo con fold 0/1 como "única", "repetida" o "inexistente". */
function resumirZona(z) {
  const [a, b] = z.candidatos;
  if (!a.existe && !b.existe) return { estado: "inexistente", utc: [] };
  if (a.utc !== b.utc && a.existe && b.existe) return { estado: "repetida", utc: [a.utc, b.utc], desfasesSeg: [a.desfaseSeg, b.desfaseSeg] };
  return { estado: "unica", utc: [a.utc], desfasesSeg: [a.desfaseSeg] };
}

function jdDesdeIso(iso) {
  const d = new Date(iso);
  const r = sweph.utc_to_jd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds() + d.getUTCMilliseconds() / 1000, C.SE_GREG_CAL);
  if (r.flag !== C.OK) throw new Error(r.error);
  return { jdTt: r.data[0], jdUt: r.data[1] };
}

const redondear = (x) => Math.round(x * 1e7) / 1e7;

function posiciones(jdUt, flagsExtra = 0) {
  const out = {};
  for (const [clave, id] of Object.entries(CUERPOS)) {
    const r = sweph.calc_ut(jdUt, id, C.SEFLG_SWIEPH | C.SEFLG_SPEED | flagsExtra);
    if (r.flag < 0 || !(r.flag & C.SEFLG_SWIEPH)) throw new Error(`Swiss Ephemeris no usó sus archivos para ${clave}: ${r.error}`);
    out[clave] = { longitud: redondear(r.data[0]), velocidad: redondear(r.data[3]) };
  }
  return out;
}

function casas(jdUt, latitud, longitud, flags = 0) {
  const out = {};
  for (const [clave, letra] of Object.entries(SISTEMAS)) {
    const r = sweph.houses_ex2(jdUt, flags, latitud, longitud, letra);
    out[clave] = {
      // Swiss Ephemeris devuelve error y usa Porfirio cuando el sistema no está definido.
      definido: r.flag === C.OK,
      cuspides: r.data.houses.map(redondear),
      asc: redondear(r.data.points[0]),
      mc: redondear(r.data.points[1]),
      armc: redondear(r.data.points[2]),
    };
  }
  return out;
}

const tzCasos = zonas(CASOS.map((c) => ({ id: c.id, fecha: c.fecha, hora: c.hora, zonaHoraria: LUGARES[c.lugar].zonaHoraria })));
const tzSolo = zonas(CASOS_ZONA);

const casos = CASOS.map((c) => {
  const lugar = LUGARES[c.lugar];
  const zona = resumirZona(tzCasos.casos.find((z) => z.id === c.id));
  if (zona.estado !== "unica") throw new Error(`El caso ${c.id} debe tener una hora local única.`);
  const { jdUt, jdTt } = jdDesdeIso(zona.utc[0]);
  const siderales = {};
  for (const [clave, modo] of Object.entries(AYANAMSAS)) {
    sweph.set_sid_mode(modo, 0, 0);
    siderales[clave] = {
      ayanamsaMedio: redondear(sweph.get_ayanamsa_ex(jdTt, C.SEFLG_SWIEPH | C.SEFLG_NONUT).data),
      sol: redondear(sweph.calc_ut(jdUt, C.SE_SUN, C.SEFLG_SWIEPH | C.SEFLG_SIDEREAL).data[0]),
      luna: redondear(sweph.calc_ut(jdUt, C.SE_MOON, C.SEFLG_SWIEPH | C.SEFLG_SIDEREAL).data[0]),
      asc: redondear(sweph.houses_ex2(jdUt, C.SEFLG_SIDEREAL, lugar.latitud, lugar.longitud, "W").data.points[0]),
    };
  }
  return {
    id: c.id,
    titulo: c.titulo,
    ficticio: c.ficticio,
    entrada: { fecha: c.fecha, hora: c.hora, lugar },
    esperado: {
      utc: zona.utc[0],
      desfaseSeg: zona.desfasesSeg[0],
      jdUt: redondear(jdUt),
      tropical: posiciones(jdUt),
      casas: casas(jdUt, lugar.latitud, lugar.longitud),
      siderales,
    },
  };
});

const salida = {
  generado: new Date().toISOString().slice(0, 10),
  fuente: {
    efemerides: `Swiss Ephemeris ${sweph.version()} (binding npm sweph 2.10.3-8, AGPL-3.0), archivos sepl_18.se1 y semo_18.se1`,
    opciones: "Geocéntrico, aparente (con aberración y deflexión), equinoccio y eclíptica verdaderos de la fecha; sideral = SEFLG_SIDEREAL; casas con swe_houses_ex2",
    zonaHoraria: `Python zoneinfo con tzdb ${tzCasos.tzdb} del sistema operativo`,
    lugares: "GeoNames cities15000 (CC BY 4.0), salvo LC-39A (coordenadas publicadas por NASA)",
  },
  casos,
  casosZona: CASOS_ZONA.map((c) => ({ ...c, esperado: resumirZona(tzSolo.casos.find((z) => z.id === c.id)) })),
};

const destino = fileURLToPath(new URL("../../src/modulos/calculo/astrologia/casos-referencia.json", import.meta.url));
writeFileSync(destino, JSON.stringify(salida, null, 1) + "\n");
console.error(`Escrito ${destino}: ${casos.length} casos de carta y ${CASOS_ZONA.length} de zona horaria.`);
