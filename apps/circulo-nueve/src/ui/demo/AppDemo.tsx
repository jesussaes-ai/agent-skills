"use client";

import { useMemo, useState } from "react";
import { CONFIG_POR_DEFECTO, calcularNumerologia, crearConfig } from "@/modulos/calculo/numerologia";
import { AvisoDemo } from "@/ui/componentes/AvisoDemo";
import { Emblema } from "@/ui/componentes/Marca";
import { Bienvenida } from "./Bienvenida";
import { Consentimiento } from "./Consentimiento";
import { FormularioPerfil } from "./FormularioPerfil";
import { PanelResultados } from "./PanelResultados";
import { PERFIL_VACIO, type Consentimientos, type Perfil, type ReglasDemo } from "./tipos";

type Paso = "bienvenida" | "consentimiento" | "perfil" | "resultados";

const PASOS: { id: Paso; nombre: string }[] = [
  { id: "bienvenida", nombre: "Te damos la bienvenida" },
  { id: "consentimiento", nombre: "Consentimiento" },
  { id: "perfil", nombre: "Perfil" },
  { id: "resultados", nombre: "Resultados" },
];

const CONSENTIMIENTO_INICIAL: Consentimientos = { avisoLeido: false, usarEnSesion: false };
const REGLAS_INICIALES: ReglasDemo = {
  numerosMaestros: CONFIG_POR_DEFECTO.numerosMaestros,
  enye: CONFIG_POR_DEFECTO.enye,
  y: CONFIG_POR_DEFECTO.y,
  metodoCaminoDeVida: CONFIG_POR_DEFECTO.metodoCaminoDeVida,
  metodoNombre: CONFIG_POR_DEFECTO.metodoNombre,
};

export function AppDemo() {
  const [paso, setPaso] = useState<Paso>("bienvenida");
  const [consentimientos, setConsentimientos] = useState(CONSENTIMIENTO_INICIAL);
  const [perfil, setPerfil] = useState<Perfil>(PERFIL_VACIO);
  const [reglas, setReglas] = useState<ReglasDemo>(REGLAS_INICIALES);

  const resultado = useMemo(
    () =>
      paso === "resultados"
        ? calcularNumerologia({ nombre: perfil.nombreNacimiento, fecha: perfil.fecha }, crearConfig(reglas))
        : null,
    [paso, perfil, reglas],
  );

  const borrarTodo = () => {
    setConsentimientos(CONSENTIMIENTO_INICIAL);
    setPerfil(PERFIL_VACIO);
    setReglas(REGLAS_INICIALES);
    setPaso("bienvenida");
  };

  const indice = PASOS.findIndex((p) => p.id === paso);

  return (
    <div className="space-y-6">
      <AvisoDemo />
      <nav aria-label="Progreso">
        <ol className="flex flex-wrap gap-2 text-sm">
          {PASOS.map((p, i) => (
            <li
              key={p.id}
              aria-current={i === indice ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${i === indice ? "bg-marino-800 text-white" : i < indice ? "bg-oro-100 text-oro-800" : "bg-slate-100 text-slate-600"}`}
            >
              {i === indice && <Emblema tamano={16} />}
              {i + 1}. {p.nombre}
            </li>
          ))}
        </ol>
      </nav>

      {paso === "bienvenida" && <Bienvenida onComenzar={() => setPaso("consentimiento")} />}
      {paso === "consentimiento" && (
        <Consentimiento
          valor={consentimientos}
          onCambiar={setConsentimientos}
          onAtras={() => setPaso("bienvenida")}
          onContinuar={() => setPaso("perfil")}
        />
      )}
      {paso === "perfil" && (
        <FormularioPerfil
          perfil={perfil}
          reglas={reglas}
          puedeUsarDatos={consentimientos.usarEnSesion}
          onCambiar={setPerfil}
          onCambiarReglas={setReglas}
          onAtras={() => setPaso("consentimiento")}
          onCalcular={() => setPaso("resultados")}
        />
      )}
      {paso === "resultados" && resultado && (
        <PanelResultados perfil={perfil} resultado={resultado} onEditar={() => setPaso("perfil")} onBorrar={borrarTodo} />
      )}
    </div>
  );
}
