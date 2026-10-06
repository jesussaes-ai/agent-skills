"use client";

import { useActionState, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { accionBorrarProveedor, accionGuardarProveedor, accionProbarProveedor } from "@/modulos/proveedores/acciones";
import { LIMITES_GRATUITOS_OPENROUTER, PLANTILLAS, esModeloGratuito, type ModeloCatalogo } from "@/modulos/proveedores/catalogo";
import { motivoNoDatosReales } from "@/modulos/proveedores/esquemas";
import { TIPOS_PROVEEDOR, type ConfigProveedor, type TipoProveedor } from "@/modulos/proveedores/tipos";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { Etiqueta } from "@/ui/componentes/Seccion";

type Tri = "si" | "no" | "desconocido";

interface Valores {
  id: string;
  tipo: TipoProveedor;
  nombre: string;
  endpoint: string;
  modelo: string;
  modelosAlternos: string;
  secretoNombre: string;
  destinatarios: string;
  json: boolean;
  herramientas: boolean;
  vision: boolean;
  audio: boolean;
  permiteDatosReales: boolean;
  confirmoPolitica: boolean;
  exigirZdr: boolean;
  entrena: Tri;
  retiene: Tri;
  politicaDescripcion: string;
  politicaFuente: string;
  solicitudesPorMinuto: string;
  solicitudesPorDia: string;
  limiteMensualUsd: string;
  maxTokensSalida: string;
  tiempoMaximoSegundos: string;
  reintentos: string;
  costoEntrada: string;
  costoSalida: string;
  prioridad: string;
  activo: boolean;
}

const tri = (v: boolean | null | undefined): Tri => (v === true ? "si" : v === false ? "no" : "desconocido");
const num = (v: number | undefined) => (v === undefined ? "" : String(v));

function conModelo(v: Valores, m: ModeloCatalogo): Valores {
  return {
    ...v,
    modelo: m.id,
    json: m.capacidades.json,
    herramientas: m.capacidades.herramientas,
    vision: m.capacidades.vision,
    audio: m.capacidades.audio,
    costoEntrada: String(m.costo.entradaUsdPorMillon),
    costoSalida: String(m.costo.salidaUsdPorMillon),
    entrena: tri(m.politica.entrena),
    retiene: tri(m.politica.retiene),
    exigirZdr: Boolean(m.politica.exigirZdr),
    politicaDescripcion: m.politica.descripcion,
    politicaFuente: m.politica.fuente ?? "",
    permiteDatosReales: false,
    confirmoPolitica: false,
  };
}

function desdePlantilla(tipo: TipoProveedor): Valores {
  const p = PLANTILLAS[tipo];
  const base: Valores = {
    id: `${tipo === "openai_compatible" ? "local" : tipo}-demo`,
    tipo,
    nombre: p.nombre,
    endpoint: p.endpoint,
    modelo: "",
    modelosAlternos: "",
    secretoNombre: p.requiereLlave ? p.secretoSugerido : "",
    destinatarios: p.destinatarios,
    json: false,
    herramientas: false,
    vision: false,
    audio: false,
    permiteDatosReales: false,
    confirmoPolitica: false,
    exigirZdr: false,
    entrena: "desconocido",
    retiene: "desconocido",
    politicaDescripcion: "",
    politicaFuente: "",
    solicitudesPorMinuto: num(p.limites.solicitudesPorMinuto),
    solicitudesPorDia: num(p.limites.solicitudesPorDia),
    limiteMensualUsd: num(p.limites.limiteMensualUsd),
    maxTokensSalida: String(p.limites.maxTokensSalida),
    tiempoMaximoSegundos: String(p.limites.tiempoMaximoMs / 1000),
    reintentos: String(p.limites.reintentos),
    costoEntrada: "0",
    costoSalida: "0",
    prioridad: "100",
    activo: true,
  };
  return p.modelos[0] ? conModelo(base, p.modelos[0]) : base;
}

function desdeConfig(c: ConfigProveedor): Valores {
  return {
    id: c.id,
    tipo: c.tipo,
    nombre: c.nombre,
    endpoint: c.endpoint,
    modelo: c.modelo,
    modelosAlternos: c.modelosAlternos.join("\n"),
    secretoNombre: c.secretoNombre ?? "",
    destinatarios: c.destinatarios,
    ...c.capacidades,
    permiteDatosReales: c.politicaDatos.permiteDatosReales,
    confirmoPolitica: c.politicaDatos.permiteDatosReales,
    exigirZdr: Boolean(c.politicaDatos.exigirZdr),
    entrena: tri(c.politicaDatos.entrena),
    retiene: tri(c.politicaDatos.retiene),
    politicaDescripcion: c.politicaDatos.descripcion,
    politicaFuente: c.politicaDatos.fuente ?? "",
    solicitudesPorMinuto: num(c.limites.solicitudesPorMinuto),
    solicitudesPorDia: num(c.limites.solicitudesPorDia),
    limiteMensualUsd: num(c.limites.limiteMensualUsd),
    maxTokensSalida: String(c.limites.maxTokensSalida),
    tiempoMaximoSegundos: String(c.limites.tiempoMaximoMs / 1000),
    reintentos: String(c.limites.reintentos),
    costoEntrada: String(c.costo.entradaUsdPorMillon),
    costoSalida: String(c.costo.salidaUsdPorMillon),
    prioridad: String(c.prioridad),
    activo: c.activo,
  };
}

function Selector({ etiqueta, nota, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { etiqueta: string; nota?: string; error?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <select id={id} aria-describedby={nota ? `${id}-nota` : undefined} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-base" {...props}>
        {children}
      </select>
      {nota && (
        <span id={`${id}-nota`} className="text-xs text-slate-500">
          {nota}
        </span>
      )}
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

function Casilla({ etiqueta, nota, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string; nota?: string; error?: string }) {
  return (
    <label className="flex items-start gap-2 text-sm text-slate-800">
      <input type="checkbox" className="mt-1" {...props} />
      <span>
        {etiqueta}
        {nota && <span className="block text-xs text-slate-500">{nota}</span>}
        {error && <span className="block text-sm text-red-700">{error}</span>}
      </span>
    </label>
  );
}

const NOMBRE_TIPO: Record<TipoProveedor, string> = {
  openrouter: "OpenRouter",
  freellmapi: "FreeLLMAPI (autoalojado)",
  openai_compatible: "Compatible con OpenAI (local o propio)",
};

export function FormularioProveedor({
  inicial,
  alTerminar,
  alGuardar,
}: {
  inicial?: ConfigProveedor;
  alTerminar?: () => void;
  /** Se llama al crear con éxito, con el mensaje para mostrar fuera del formulario. */
  alGuardar?: (mensaje: string) => void;
}) {
  const nuevo = !inicial;
  const [v, setV] = useState<Valores>(() => (inicial ? desdeConfig(inicial) : desdePlantilla("openrouter")));
  const [estado, accion] = useActionState(accionGuardarProveedor, ESTADO_INICIAL);
  const e = estado.errores ?? {};
  useEffect(() => {
    if (estado.ok && estado.mensaje) alGuardar?.(estado.mensaje);
  }, [estado, alGuardar]);
  const cambiar = <K extends keyof Valores>(k: K, valor: Valores[K]) => setV((x) => ({ ...x, [k]: valor }));
  const texto = (k: keyof Valores) => ({ name: k, value: String(v[k]), onChange: (ev: { target: { value: string } }) => cambiar(k, ev.target.value as never) });
  const casilla = (k: keyof Valores) => ({ name: k, checked: Boolean(v[k]), onChange: (ev: { target: { checked: boolean } }) => cambiar(k, ev.target.checked as never) });

  const plantilla = PLANTILLAS[v.tipo];
  const delCatalogo = plantilla.modelos.find((m) => m.id === v.modelo);
  const motivo = motivoNoDatosReales({
    tipo: v.tipo,
    modelos: [v.modelo, ...v.modelosAlternos.split(/[\n,]+/).map((m) => m.trim()).filter(Boolean)],
    entrena: v.entrena === "si" ? true : v.entrena === "no" ? false : null,
    retiene: v.retiene === "si" ? true : v.retiene === "no" ? false : null,
    exigirZdr: v.exigirZdr,
  });

  return (
    <form action={accion} className="space-y-5" noValidate>
      <input type="hidden" name="nuevo" value={nuevo ? "1" : "0"} />
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 font-semibold text-slate-900">Proveedor y modelo</legend>
        <Selector
          etiqueta="Tipo de proveedor"
          name="tipo"
          value={v.tipo}
          disabled={!nuevo}
          onChange={(ev) => setV({ ...desdePlantilla(ev.target.value as TipoProveedor), id: v.id })}
          nota={plantilla.descripcion}
        >
          {TIPOS_PROVEEDOR.map((t) => (
            <option key={t} value={t}>
              {NOMBRE_TIPO[t]}
            </option>
          ))}
        </Selector>
        {!nuevo && <input type="hidden" name="tipo" value={v.tipo} />}
        <Campo
          etiqueta="Identificador"
          {...texto("id")}
          readOnly={!nuevo}
          error={e.id}
          nota="Corto y en minúsculas (p. ej. openrouter-demo). No se puede cambiar después."
        />
        <Campo etiqueta="Nombre visible" {...texto("nombre")} error={e.nombre} nota="Lo ve la persona al elegir cómo responder." />
        <Campo
          etiqueta="Endpoint (URL base /v1)"
          {...texto("endpoint")}
          error={e.endpoint}
          nota="https siempre; http solo para tu equipo o red local. En Vercel, localhost no funciona."
        />
        {plantilla.modelos.length > 0 && (
          <Selector
            etiqueta="Modelo del catálogo verificado"
            value={delCatalogo ? v.modelo : ""}
            onChange={(ev) => {
              const m = plantilla.modelos.find((x) => x.id === ev.target.value);
              if (m) setV((x) => conModelo(x, m));
            }}
            nota={delCatalogo ? `${delCatalogo.nota} Verificado el ${delCatalogo.politica.verificadoEn}.` : "Elige uno o escribe otro id abajo."}
          >
            <option value="">Otro (escribir el id)</option>
            {plantilla.modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </Selector>
        )}
        <Campo etiqueta="Id del modelo (selección manual)" {...texto("modelo")} error={e.modelo} nota="Exactamente como lo espera el endpoint. No se elige al azar." />
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label className="text-sm font-medium text-slate-700">
            Modelos de respaldo (uno por línea, máx. 5)
            <textarea
              {...texto("modelosAlternos")}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
            />
          </label>
          <span className="text-xs text-slate-500">Si el modelo principal responde 429 o falla, se prueban estos en orden, con el mismo proveedor.</span>
          {e.modelosAlternos && <span className="text-sm text-red-700">{e.modelosAlternos}</span>}
        </div>
        <Campo
          etiqueta="Nombre del secreto con la llave"
          {...texto("secretoNombre")}
          error={e.secretoNombre}
          nota="Variable de entorno del servidor que empieza con LLM_KEY_ (p. ej. LLM_KEY_OPENROUTER). La llave se carga en Vercel, nunca aquí."
        />
        <Campo etiqueta="Prioridad como respaldo" type="number" {...texto("prioridad")} error={e.prioridad} nota="Menor número = se usa antes como respaldo de otros proveedores." />
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">Capacidades</legend>
        <div className="flex flex-wrap gap-4">
          <Casilla etiqueta="Respuesta en JSON" {...casilla("json")} nota="El asistente lo pide si está marcado." />
          <Casilla etiqueta="Herramientas" {...casilla("herramientas")} />
          <Casilla etiqueta="Visión (imágenes)" {...casilla("vision")} />
          <Casilla etiqueta="Audio" {...casilla("audio")} />
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 font-semibold text-slate-900">Política de datos</legend>
        <Campo
          etiqueta="Quién recibe los datos"
          {...texto("destinatarios")}
          error={e.destinatarios}
          nota="Se muestra a la persona antes de pedir su consentimiento."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Selector etiqueta="¿Entrena con los datos?" name="entrena" value={v.entrena} onChange={(ev) => cambiar("entrena", ev.target.value as Tri)}>
            <option value="desconocido">Desconocido (se trata como sí)</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </Selector>
          <Selector etiqueta="¿Retiene los datos?" name="retiene" value={v.retiene} onChange={(ev) => cambiar("retiene", ev.target.value as Tri)}>
            <option value="desconocido">Desconocido (se trata como sí)</option>
            <option value="si">Sí</option>
            <option value="no">No</option>
          </Selector>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Resumen de la política
            <textarea {...texto("politicaDescripcion")} rows={3} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>
          {e.politicaDescripcion && <span className="text-sm text-red-700">{e.politicaDescripcion}</span>}
        </div>
        <Campo etiqueta="Fuente de la política (https)" {...texto("politicaFuente")} error={e.politicaFuente} />
        {v.tipo === "openrouter" && (
          <Casilla
            etiqueta="Exigir retención cero (ZDR) en cada solicitud"
            {...casilla("exigirZdr")}
            nota="Envía provider.zdr y data_collection: deny; OpenRouter solo enruta a endpoints que no guardan los textos. Los modelos gratuitos suelen quedar sin endpoint disponible."
          />
        )}
        <Casilla
          etiqueta="Apto para datos reales"
          {...casilla("permiteDatosReales")}
          error={e.permiteDatosReales}
          nota={motivo ?? "Las reglas lo permiten. Requiere tu confirmación y la aprobación del responsable."}
        />
        {v.permiteDatosReales && (
          <Casilla
            etiqueta="Confirmo que revisé hoy la política vigente del endpoint y que no entrena ni retiene datos personales."
            {...casilla("confirmoPolitica")}
            error={e.confirmoPolitica}
          />
        )}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 font-semibold text-slate-900">Límites y costo</legend>
        <Campo etiqueta="Solicitudes por minuto" type="number" min={0} {...texto("solicitudesPorMinuto")} error={e.solicitudesPorMinuto} nota="Vacío = sin límite local." />
        <Campo
          etiqueta="Solicitudes por día"
          type="number"
          min={0}
          {...texto("solicitudesPorDia")}
          error={e.solicitudesPorDia}
          nota={v.tipo === "openrouter" ? `Gratis: ${LIMITES_GRATUITOS_OPENROUTER.solicitudesPorDiaSinCreditos}/día (${LIMITES_GRATUITOS_OPENROUTER.solicitudesPorDiaConCreditos} con ≥ ${LIMITES_GRATUITOS_OPENROUTER.creditosUmbralUsd} USD comprados).` : "Vacío = sin límite local."}
        />
        <Campo
          etiqueta="Límite de gasto mensual (USD)"
          type="number"
          min={0}
          step="0.01"
          {...texto("limiteMensualUsd")}
          error={e.limiteMensualUsd}
          nota="0 o vacío bloquea cualquier solicitud con costo."
        />
        <Campo etiqueta="Costo entrada (USD por millón de tokens)" type="number" min={0} step="0.0001" {...texto("costoEntrada")} error={e.costoEntrada} />
        <Campo etiqueta="Costo salida (USD por millón de tokens)" type="number" min={0} step="0.0001" {...texto("costoSalida")} error={e.costoSalida} />
        <Campo etiqueta="Tokens máximos de salida" type="number" min={16} {...texto("maxTokensSalida")} error={e.maxTokensSalida} />
        <Campo etiqueta="Tiempo máximo (segundos)" type="number" min={2} {...texto("tiempoMaximoSegundos")} error={e.tiempoMaximoSegundos} />
        <Campo etiqueta="Reintentos ante 429/5xx" type="number" min={0} max={4} {...texto("reintentos")} error={e.reintentos} nota="Con espera creciente; respeta Retry-After." />
      </fieldset>

      <Casilla etiqueta="Activo (aparece en el asistente)" {...casilla("activo")} />
      {esModeloGratuito(v.modelo) && (
        <p role="note" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
          Modelo gratuito: quedará como «solo demo». Los endpoints gratuitos pueden cambiar o desaparecer sin aviso; añade modelos de respaldo.
        </p>
      )}
      <MensajeFormulario estado={estado} />
      <div className="flex flex-wrap gap-2">
        <BotonEnviar descripcion="Guarda la configuración en el servidor. La llave no se guarda: solo el nombre del secreto.">
          {nuevo ? "Crear proveedor" : "Guardar cambios"}
        </BotonEnviar>
        {alTerminar && (
          <Boton variante="secundario" descripcion="Cierra el formulario sin guardar." onClick={alTerminar}>
            Cerrar
          </Boton>
        )}
      </div>
    </form>
  );
}

function AccionesProveedor({ id, nombre, onEditar }: { id: string; nombre: string; onEditar: () => void }) {
  const [prueba, probar] = useActionState(accionProbarProveedor, ESTADO_INICIAL);
  const [borrado, borrar] = useActionState(accionBorrarProveedor, ESTADO_INICIAL);
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <form action={probar}>
          <input type="hidden" name="id" value={id} />
          <BotonEnviar variante="secundario" descripcion="Envía un texto fijo («Responde solo con la palabra: listo»), sin datos de nadie, y muestra si respondió y en cuánto tiempo. Cuenta como una solicitud.">
            Probar conexión
          </BotonEnviar>
        </form>
        <Boton variante="secundario" descripcion={`Edita la configuración de «${nombre}».`} onClick={onEditar}>
          Editar
        </Boton>
        {confirmar ? (
          <form action={borrar} className="flex flex-wrap gap-2">
            <input type="hidden" name="id" value={id} />
            <BotonEnviar descripcion={`Borra «${nombre}» y su historial de consumo. No se puede deshacer.`}>Confirmar borrado</BotonEnviar>
            <Boton variante="secundario" descripcion="No borrar." onClick={() => setConfirmar(false)}>
              Cancelar
            </Boton>
          </form>
        ) : (
          <Boton variante="sutil" descripcion={`Borra «${nombre}». Pide confirmación.`} onClick={() => setConfirmar(true)}>
            Borrar
          </Boton>
        )}
      </div>
      <MensajeFormulario estado={prueba} />
      <MensajeFormulario estado={borrado} />
    </div>
  );
}

export function ListaProveedores({ proveedores }: { proveedores: { config: ConfigProveedor; tieneLlave: boolean }[] }) {
  const [editando, setEditando] = useState<string | null>(null);
  const [creando, setCreando] = useState(proveedores.length === 0);
  const [aviso, setAviso] = useState("");
  return (
    <div className="space-y-4">
      {aviso && (
        <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          {aviso}
        </p>
      )}
      {proveedores.length === 0 && <p className="text-slate-700">Aún no hay proveedores. El asistente funciona en modo demo sin IA.</p>}
      {proveedores.map(({ config: c, tieneLlave }) => (
        <article key={c.id} className="space-y-3 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold text-slate-900">{c.nombre}</h3>
            <Etiqueta tono={c.activo ? "violeta" : "gris"}>{c.activo ? "Activo" : "Inactivo"}</Etiqueta>
            <Etiqueta tono={c.politicaDatos.permiteDatosReales ? "violeta" : "ambar"}>
              {c.politicaDatos.permiteDatosReales ? "Apto para datos reales" : "Solo demo"}
            </Etiqueta>
            <Etiqueta tono={tieneLlave || !PLANTILLAS[c.tipo].requiereLlave ? "gris" : "ambar"}>
              {c.secretoNombre ? `${c.secretoNombre}: ${tieneLlave ? "cargada" : "falta"}` : "Sin llave"}
            </Etiqueta>
          </div>
          <dl className="grid gap-x-4 gap-y-1 text-sm text-slate-700 sm:grid-cols-2">
            <div>
              <dt className="inline font-medium">Modelo: </dt>
              <dd className="inline font-mono">{c.modelo}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Respaldos: </dt>
              <dd className="inline font-mono">{c.modelosAlternos.join(", ") || "ninguno"}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Endpoint: </dt>
              <dd className="inline font-mono">{c.endpoint}</dd>
            </div>
            <div>
              <dt className="inline font-medium">Límites: </dt>
              <dd className="inline">
                {c.limites.solicitudesPorMinuto ?? "∞"}/min · {c.limites.solicitudesPorDia ?? "∞"}/día · {c.limites.limiteMensualUsd ?? 0} USD/mes
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Costo: </dt>
              <dd className="inline">
                {c.costo.entradaUsdPorMillon} / {c.costo.salidaUsdPorMillon} USD por millón (entrada/salida)
              </dd>
            </div>
            <div>
              <dt className="inline font-medium">Política: </dt>
              <dd className="inline">{c.politicaDatos.descripcion}</dd>
            </div>
          </dl>
          {editando === c.id ? (
            <FormularioProveedor inicial={c} alTerminar={() => setEditando(null)} />
          ) : (
            <AccionesProveedor id={c.id} nombre={c.nombre} onEditar={() => setEditando(c.id)} />
          )}
        </article>
      ))}
      {creando ? (
        <div className="rounded-xl border border-marino-200 bg-marino-50/40 p-4">
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Nuevo proveedor</h3>
          <FormularioProveedor
            alTerminar={proveedores.length ? () => setCreando(false) : undefined}
            alGuardar={(mensaje) => {
              setAviso(mensaje);
              setCreando(false);
            }}
          />
        </div>
      ) : (
        <Boton
          descripcion="Abre el formulario para dar de alta un proveedor desde una plantilla (OpenRouter, FreeLLMAPI o compatible con OpenAI)."
          onClick={() => {
            setAviso("");
            setCreando(true);
          }}
        >
          Añadir proveedor
        </Boton>
      )}
    </div>
  );
}
