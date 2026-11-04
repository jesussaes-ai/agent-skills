"use client";

import { LETRAS } from "@/modulos/calculo/cabala";
import { Boton } from "@/ui/componentes/Boton";

/** Teclado en pantalla con las 22 letras hebreas y sus 5 formas finales, para corregir la transliteración. */
export function TecladoHebreo({ onLetra, onBorrar, onEspacio }: { onLetra: (l: string) => void; onBorrar: () => void; onEspacio: () => void }) {
  const teclas = LETRAS.flatMap((l) => [
    { letra: l.letra, nombre: l.nombre, valor: l.valor },
    ...(l.final ? [{ letra: l.final, nombre: `${l.nombre} final`, valor: l.valorFinalGadol ?? l.valor }] : []),
  ]);
  return (
    <div className="space-y-2" dir="rtl">
      <div className="flex flex-wrap gap-1.5">
        {teclas.map((t) => (
          <Boton
            key={t.letra}
            variante="secundario"
            className="!px-2.5 !py-1 text-xl"
            lang="he"
            aria-label={t.nombre}
            descripcion={`Añade la letra ${t.nombre} (${t.letra}). Valor ${t.valor}.`}
            onClick={() => onLetra(t.letra)}
          >
            {t.letra}
          </Boton>
        ))}
      </div>
      <div className="flex flex-wrap gap-2" dir="ltr">
        <Boton variante="secundario" className="!py-1" descripcion="Añade un espacio entre palabras del nombre." onClick={onEspacio}>
          Espacio
        </Boton>
        <Boton variante="secundario" className="!py-1" descripcion="Borra la última letra escrita." onClick={onBorrar}>
          ⌫ Borrar letra
        </Boton>
      </div>
    </div>
  );
}
