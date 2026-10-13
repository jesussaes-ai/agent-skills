import { DibujoMotivo } from "./Motivos";

/** Capa de fondo fija con motivos de la marca; solo decoración. */
export function FondoDecorativo() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <DibujoMotivo motivo="rueda" className="giro-lento absolute -right-40 -top-40 h-[34rem] w-[34rem] text-oro-500 opacity-[0.10]" />
      <DibujoMotivo motivo="emblema" className="absolute -bottom-32 -left-32 h-[28rem] w-[28rem] text-marino-800 opacity-[0.05]" />
      <DibujoMotivo motivo="constelacion" className="absolute left-[8%] top-[38%] hidden h-40 w-40 text-oro-500 opacity-[0.14] lg:block" />
      <DibujoMotivo motivo="numeros" className="absolute bottom-[12%] right-[6%] hidden h-36 w-36 text-marino-800 opacity-[0.06] lg:block" />
    </div>
  );
}
