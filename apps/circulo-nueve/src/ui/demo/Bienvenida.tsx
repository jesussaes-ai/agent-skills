"use client";

import { Boton } from "@/ui/componentes/Boton";
import { Seccion } from "@/ui/componentes/Seccion";

export function Bienvenida({ onComenzar }: { onComenzar: () => void }) {
  return (
    <Seccion titulo="Te damos la bienvenida" ayuda="bienvenida">
      <div className="space-y-3 text-slate-700">
        <p>
          Círculo Nueve te acompaña a explorar la <strong>numerología</strong>, la <strong>carta natal</strong> y la{" "}
          <strong>cábala</strong> como sistemas simbólicos para reflexionar sobre ti.
        </p>
        <p>
          Los cálculos son reproducibles y muestran cada paso. Las interpretaciones son posibilidades de reflexión: no
          son hechos científicos, diagnósticos ni predicciones, y no sustituyen la asesoría médica, psicológica, legal o
          financiera.
        </p>
        <p>Tú decides qué datos compartes. Puedes usar la app sin guardar nada.</p>
      </div>
      <div className="mt-5">
        <Boton descripcion="Pasa al aviso de privacidad y a elegir tus permisos." onClick={onComenzar}>
          Comenzar
        </Boton>
      </div>
    </Seccion>
  );
}
