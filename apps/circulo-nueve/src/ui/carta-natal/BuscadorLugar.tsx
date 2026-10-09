"use client";

import { SelectorZonaHoraria } from "@/ui/componentes/SelectorZonaHoraria";
import { useId, useState, type FormEvent } from "react";
import {
  RUTA_CATALOGO,
  aLugarNacimiento,
  buscarLugares,
  esZonaValida,
  lugarManual,
  nombrePais,
  type CatalogoLugares,
  type FilaLugar,
  type LugarNacimiento,
} from "@/modulos/calculo/astrologia";
import { AyudaContextual } from "@/ui/componentes/AyudaContextual";
import { Boton } from "@/ui/componentes/Boton";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";

const claseCampo = "rounded-lg border border-slate-300 px-3 py-2 text-base";

let catalogoEnMemoria: Promise<CatalogoLugares> | null = null;
function cargarCatalogo(): Promise<CatalogoLugares> {
  catalogoEnMemoria ??= fetch(RUTA_CATALOGO).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<CatalogoLugares>;
  });
  catalogoEnMemoria.catch(() => (catalogoEnMemoria = null));
  return catalogoEnMemoria;
}

export function formatoCoordenadas(lat: number, lon: number): string {
  const f = (v: number) => Math.abs(v).toLocaleString("es-MX", { maximumFractionDigits: 4 });
  return `${f(lat)}° ${lat >= 0 ? "N" : "S"}, ${f(lon)}° ${lon >= 0 ? "E" : "O"}`;
}

interface Props {
  consultaInicial: string;
  lugar: LugarNacimiento | null;
  onElegir: (l: LugarNacimiento | null) => void;
}

export function BuscadorLugar({ consultaInicial, lugar, onElegir }: Props) {
  const idConsulta = useId();
  const [consulta, setConsulta] = useState(consultaInicial);
  const [estado, setEstado] = useState<"inicial" | "cargando" | "listo" | "error">("inicial");
  const [catalogo, setCatalogo] = useState<CatalogoLugares | null>(null);
  const [resultados, setResultados] = useState<FilaLugar[]>([]);
  const [manual, setManual] = useState(false);
  const [m, setM] = useState({ nombre: "", lat: "", lon: "", zona: "" });
  const [errorManual, setErrorManual] = useState("");

  const buscar = async (e: FormEvent) => {
    e.preventDefault();
    setEstado("cargando");
    try {
      const c = catalogo ?? (await cargarCatalogo());
      setCatalogo(c);
      setResultados(buscarLugares(c, consulta));
      setEstado("listo");
    } catch {
      setEstado("error");
    }
  };

  const guardarManual = (e: FormEvent) => {
    e.preventDefault();
    const lat = Number(m.lat.replace(",", "."));
    const lon = Number(m.lon.replace(",", "."));
    if (!m.lat || !m.lon || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      setErrorManual("Escribe la latitud (−90 a 90, sur negativo) y la longitud (−180 a 180, oeste negativo) en grados decimales.");
      return;
    }
    if (!esZonaValida(m.zona.trim())) {
      setErrorManual("Escribe una zona IANA válida, por ejemplo America/Mexico_City. No se adivina.");
      return;
    }
    setErrorManual("");
    onElegir(lugarManual(m.nombre, lat, lon, m.zona.trim()));
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-900">Lugar y zona horaria</h3>
        <AyudaContextual seccion="carta-natal-lugar" />
      </div>

      {lugar ? (
        <div className="rounded-lg bg-marino-50 p-3 text-sm text-slate-800">
          <p className="font-semibold">{lugar.nombre}</p>
          <dl className="mt-1 grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
            <dt className="font-medium">Coordenadas</dt>
            <dd>
              {formatoCoordenadas(lugar.latitud, lugar.longitud)} (±{lugar.incertidumbreGrados.toLocaleString("es-MX")}°)
            </dd>
            <dt className="font-medium">Zona horaria</dt>
            <dd>{lugar.zonaHoraria ?? "sin zona"}</dd>
            <dt className="font-medium">Fuente</dt>
            <dd>
              {lugar.fuente.tipo === "geonames" ? (
                <>
                  GeoNames, id{" "}
                  <EnlaceBoton
                    href={`https://www.geonames.org/${lugar.fuente.geonameId}`}
                    descripcion="Abre la ficha de este lugar en GeoNames (sitio externo) para comprobar las coordenadas."
                    className="px-0"
                  >
                    {lugar.fuente.geonameId}
                  </EnlaceBoton>{" "}
                  · {lugar.fuente.atribucion}
                </>
              ) : (
                lugar.fuente.descripcion
              )}
            </dd>
          </dl>
          <Boton variante="sutil" className="mt-2 px-0" descripcion="Quita este lugar para buscar otro." onClick={() => onElegir(null)}>
            Cambiar lugar
          </Boton>
        </div>
      ) : (
        <>
          <form onSubmit={buscar} className="flex flex-wrap items-end gap-3">
            <label htmlFor={idConsulta} className="flex min-w-56 flex-1 flex-col gap-1 text-sm font-medium text-slate-700">
              Ciudad (y, tras una coma, región o país)
              <input
                id={idConsulta}
                className={claseCampo}
                value={consulta}
                maxLength={120}
                autoComplete="off"
                placeholder="Guadalajara, Jalisco"
                onChange={(e) => setConsulta(e.target.value)}
              />
            </label>
            <Boton
              type="submit"
              descripcion="Busca la ciudad en el catálogo GeoNames descargado en tu navegador. El nombre que escribes no se envía a nadie."
              disabled={estado === "cargando"}
            >
              {estado === "cargando" ? "Cargando catálogo…" : "Buscar lugar"}
            </Boton>
          </form>
          <p className="text-xs text-slate-600">
            La búsqueda ocurre en tu dispositivo: la primera vez se descarga el catálogo completo (unos 1,5 MB), sin enviar lo que escribes.
          </p>
          {estado === "error" && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-900">
              No se pudo descargar el catálogo de lugares. Revisa la conexión o escribe las coordenadas a mano.
            </p>
          )}
          {estado === "listo" && (
            <div aria-live="polite">
              {resultados.length === 0 ? (
                <p className="text-sm text-slate-700">
                  Sin coincidencias. El catálogo incluye ciudades del mundo con 15 000 habitantes o más y de México con 1 000 o más. Prueba otro nombre o escribe las coordenadas.
                </p>
              ) : (
                <ul className="space-y-2">
                  {resultados.map((f) => (
                    <li key={f[0]}>
                      <Boton
                        variante="secundario"
                        className="w-full justify-between text-left"
                        descripcion={`Usa ${f[1]} (${f[7]}) como lugar de nacimiento.`}
                        onClick={() => onElegir(aLugarNacimiento(f, catalogo!))}
                      >
                        <span>
                          {f[1]}
                          {f[3] && f[3] !== f[1] ? `, ${f[3]}` : ""}, {nombrePais(f[4])}
                        </span>
                        <span className="text-xs font-normal text-slate-600">
                          {formatoCoordenadas(f[5], f[6])} · {f[7]}
                        </span>
                      </Boton>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Boton
            variante="sutil"
            className="px-0"
            aria-expanded={manual}
            descripcion="Permite escribir latitud, longitud y zona horaria si el lugar no aparece o conoces datos más precisos."
            onClick={() => setManual((v) => !v)}
          >
            {manual ? "Ocultar coordenadas manuales" : "Escribir coordenadas a mano"}
          </Boton>
          {manual && (
            <form onSubmit={guardarManual} className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["nombre", "Nombre del lugar (opcional)", "Hospital, colonia…"],
                  ["lat", "Latitud (grados decimales, sur negativo)", "19.4285"],
                  ["lon", "Longitud (grados decimales, oeste negativo)", "-99.1277"],
                ] as const
              ).map(([clave, etiqueta, ejemplo]) => (
                <label key={clave} className="flex flex-col gap-1 text-sm font-medium text-slate-700">
                  {etiqueta}
                  <input
                    className={claseCampo}
                    value={m[clave]}
                    placeholder={ejemplo}
                    maxLength={80}
                    inputMode={clave === "lat" || clave === "lon" ? "decimal" : undefined}
                    onChange={(e) => setM({ ...m, [clave]: e.target.value })}
                  />
                </label>
              ))}
              <SelectorZonaHoraria etiqueta="Zona horaria IANA" valor={m.zona} onCambiar={(zona) => setM({ ...m, zona })} />
              {errorManual && (
                <p role="alert" className="text-sm text-red-700 sm:col-span-2">
                  {errorManual}
                </p>
              )}
              <div className="sm:col-span-2">
                <Boton type="submit" variante="secundario" descripcion="Usa estas coordenadas y esta zona horaria para la carta.">
                  Usar estas coordenadas
                </Boton>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
