"use client";

import { useActionState, useState } from "react";
import { NOMBRES_AYANAMSA, NOMBRES_SISTEMA_CASAS, type LugarNacimiento, type ResultadoCarta } from "@/modulos/calculo/astrologia";
import { accionGuardarCarta } from "@/modulos/expedientes/acciones-carta";
import { BotonEnviar, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { PanelCartaNatal, ResultadosCarta, type DatosNacimiento, type EstadoCarta } from "./SeccionCartaNatal";

function CamposLugar({ lugar }: { lugar: LugarNacimiento }) {
  if (lugar.fuente.tipo === "geonames") {
    return (
      <>
        <input type="hidden" name="lugarTipo" value="geonames" />
        <input type="hidden" name="geonameId" value={lugar.fuente.geonameId} />
      </>
    );
  }
  return (
    <>
      <input type="hidden" name="lugarTipo" value="manual" />
      <input type="hidden" name="nombreLugar" value={lugar.nombre} />
      <input type="hidden" name="latitud" value={lugar.latitud} />
      <input type="hidden" name="longitud" value={lugar.longitud} />
      <input type="hidden" name="zonaLugar" value={lugar.zonaHoraria ?? ""} />
    </>
  );
}

function FormularioGuardar({ id, estado, puedeGuardar, consentido }: { id: string; estado: EstadoCarta; puedeGuardar: boolean; consentido: boolean }) {
  const [respuesta, accion] = useActionState(accionGuardarCarta, ESTADO_INICIAL);
  if (!puedeGuardar) return null;
  const listo = consentido && !!estado.lugar && !!estado.resultado?.ok;
  return (
    <form action={accion} className="space-y-3 rounded-xl border border-marino-200 bg-marino-50 p-4">
      <input type="hidden" name="expedienteId" value={id} />
      <input type="hidden" name="config" value={JSON.stringify(estado.config)} />
      <input type="hidden" name="ocurrencia" value={estado.ocurrencia ?? ""} />
      {estado.lugar && <CamposLugar lugar={estado.lugar} />}
      {!consentido && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Para guardar la carta, activa «Guardar las lecturas y reportes en el historial» en Consentimientos. Mientras tanto
          puedes calcularla sin guardar.
        </p>
      )}
      {consentido && !estado.lugar && <p className="text-sm text-slate-700">Elige el lugar de nacimiento para poder guardar la carta.</p>}
      <p className="text-sm text-slate-700">
        Al guardar, el servidor vuelve a calcular la carta con la fecha, la hora y la zona del perfil guardado, el lugar elegido
        y estos ajustes, y registra el motor, las versiones y los ajustes usados.
      </p>
      <MensajeFormulario estado={respuesta} />
      <BotonEnviar
        disabled={!listo}
        descripcion="Recalcula la carta en el servidor y la guarda en el historial del expediente con su motor, versiones y ajustes."
      >
        Guardar carta natal
      </BotonEnviar>
    </form>
  );
}

interface Props {
  id: string;
  datos: DatosNacimiento;
  lugarInicial: LugarNacimiento | null;
  puedeGuardar: boolean;
  consentido: boolean;
}

export function CartaExpediente({ id, datos, lugarInicial, puedeGuardar, consentido }: Props) {
  return (
    <PanelCartaNatal
      datos={datos}
      lugarInicial={lugarInicial}
      acciones={(estado) => <FormularioGuardar id={id} estado={estado} puedeGuardar={puedeGuardar} consentido={consentido} />}
    />
  );
}

/** Carta guardada en el historial: resumen, versiones y detalle desplegable. */
export function CartaGuardada({ r }: { r: ResultadoCarta }) {
  const [abierta, setAbierta] = useState(false);
  const texto = (clave: string) => r.posiciones.find((p) => p.clave === clave)?.texto;
  const asc = texto("asc");
  return (
    <div className="space-y-2" data-testid="carta-guardada">
      <p className="text-sm text-slate-900">
        <span className="font-medium">Sol</span> {texto("sol")} · <span className="font-medium">Luna</span> {texto("luna")}
        {asc ? (
          <>
            {" "}
            · <span className="font-medium">Ascendente</span> {asc}
          </>
        ) : (
          " · sin casas (hora desconocida)"
        )}
      </p>
      <p className="text-xs text-slate-600">
        {r.entradas.lugar?.nombre ?? "Sin lugar"} · {r.tiempo.utc.replace("T", " ").replace("Z", "")} UT ({r.tiempo.desfaseTexto}) · zodiaco{" "}
        {r.config.zodiaco}
        {r.config.zodiaco === "sideral" ? ` (${NOMBRES_AYANAMSA[r.config.ayanamsa]})` : ""}
        {r.casas ? ` · ${NOMBRES_SISTEMA_CASAS[r.casas.sistemaUsado]}` : ""} · efemérides {r.efemerides} · {r.tiempo.versionTzdb}
      </p>
      <Boton
        variante="sutil"
        className="px-0 text-sm"
        aria-expanded={abierta}
        descripcion={`${abierta ? "Oculta" : "Muestra"} la rueda, las posiciones, las casas, los aspectos y los pasos de esta carta guardada.`}
        onClick={() => setAbierta((v) => !v)}
      >
        {abierta ? "Ocultar carta" : "Ver carta completa"}
      </Boton>
      {abierta && <ResultadosCarta r={r} />}
    </div>
  );
}
