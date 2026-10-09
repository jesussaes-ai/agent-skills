"use client";

import type { ReactNode } from "react";
import { Explicacion } from "@/ui/componentes/Explicacion";

/** Término del glosario con ventana explicativa, accesible con teclado y al tocar. */
export function Termino({ children, explicacion }: { children: ReactNode; explicacion: string }) {
  return (
    <Explicacion descripcion={explicacion}>
      {(disparador) => (
        <span
          tabIndex={0}
          {...disparador}
          className="cursor-help underline decoration-dotted decoration-marino-300 underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-marino-800"
        >
          {children}
        </span>
      )}
    </Explicacion>
  );
}

export const GLOSARIO = {
  longitud: "Posición sobre la eclíptica medida desde 0° Aries. Se muestra con la precisión que permiten la hora y el lugar.",
  casa: "Sector de la carta según el sistema de casas elegido. Solo existe si se conocen la hora y el lugar.",
  movimiento: "Directo o retrógrado (℞): visto desde la Tierra, el planeta parece avanzar o retroceder en el zodiaco.",
  ascendente: "Grado del zodiaco que asciende por el horizonte este en el momento y lugar del nacimiento. Cambia unos 1° cada 4 minutos.",
  medioCielo: "Grado del zodiaco que culmina en el meridiano del lugar.",
  orbe: "Distancia, en grados, entre el ángulo exacto del aspecto y la separación real de los dos puntos.",
  incierto: "Dentro de los márgenes de hora o lugar, este aspecto podría estar dentro o fuera del orbe configurado.",
  aplicativo: "Aplicativo: los puntos se acercan al aspecto exacto. Separativo: se alejan.",
  precision:
    "«Al minuto» si la posición varía menos de 2′ dentro de los márgenes de hora y lugar; «aproximada» si varía menos de 2° (se indica el ±); si no, se muestra el rango completo.",
} as const;
