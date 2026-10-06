"use client";

import { useEffect, useRef, useState } from "react";
import { constructorReconocimiento, iniciarDictado, type SesionDictado } from "@/modulos/proveedores/voz/reconocimiento";
import { Boton } from "@/ui/componentes/Boton";

type Fase = "sin-soporte" | "inicial" | "aviso" | "escuchando";

/** Dictado opcional: solo se activa el micrófono tras aceptar el aviso. */
export function DictadoVoz({ alTexto }: { alTexto: (texto: string) => void }) {
  const [fase, setFase] = useState<Fase>("inicial");
  const [aceptado, setAceptado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const sesion = useRef<SesionDictado | null>(null);

  useEffect(() => {
    if (!constructorReconocimiento()) setFase("sin-soporte");
    return () => sesion.current?.detener();
  }, []);

  const empezar = () => {
    const Rec = constructorReconocimiento();
    if (!Rec) return setFase("sin-soporte");
    setAceptado(true);
    setMensaje("");
    setFase("escuchando");
    sesion.current = iniciarDictado(Rec, {
      idioma: "es-MX",
      alTexto: (t) => alTexto(t),
      alError: (m) => setMensaje(m),
      alTerminar: () => setFase("inicial"),
    });
  };

  if (fase === "sin-soporte") {
    return <p className="text-xs text-slate-500">Este navegador no ofrece dictado por voz; escribe tu pregunta.</p>;
  }

  return (
    <div className="space-y-2">
      {fase === "aviso" && (
        <div role="dialog" aria-label="Permiso para dictar" className="space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
          <p>
            Para dictar, el navegador te pedirá permiso para usar el <strong>micrófono</strong>. Solo escucha mientras dictas. En muchos
            navegadores (por ejemplo, Chrome) el audio se procesa en servidores del fabricante del navegador, no en la app. No dictes datos
            personales si usas un proveedor «solo demo».
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton descripcion="Acepta el aviso, pide permiso al navegador para usar el micrófono y empieza a dictar." onClick={empezar}>
              Permitir micrófono y dictar
            </Boton>
            <Boton variante="secundario" descripcion="Cierra el aviso sin activar el micrófono." onClick={() => setFase("inicial")}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}
      {fase === "escuchando" ? (
        <Boton variante="secundario" descripcion="Deja de escuchar el micrófono." onClick={() => sesion.current?.detener()}>
          Detener dictado
        </Boton>
      ) : (
        fase === "inicial" && (
          <Boton
            variante="secundario"
            descripcion="Dicta tu pregunta con el micrófono. Antes se muestra un aviso y se pide tu permiso."
            onClick={() => (aceptado ? empezar() : setFase("aviso"))}
          >
            Dictar pregunta
          </Boton>
        )
      )}
      {fase === "escuchando" && (
        <p role="status" className="text-sm text-slate-600">
          Escuchando… habla ahora.
        </p>
      )}
      {mensaje && (
        <p role="alert" className="text-sm text-red-700">
          {mensaje}
        </p>
      )}
    </div>
  );
}
