"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { accionCancelarCargaDocumento, accionConfirmarCargaDocumento, accionPrepararCargaDocumento } from "@/modulos/expedientes/acciones-carga";
import { subirConProgreso } from "@/modulos/carga/subir-firmado";
import type { EstadoFormulario } from "@/modulos/auth/esquemas";
import { MensajeFormulario } from "@/ui/auth/Campos";
import { Boton } from "@/ui/componentes/Boton";
import { SelectorArchivos, useColaCarga } from "@/ui/carga/SelectorArchivos";

interface Props {
  expedienteId: string;
  supabaseUrl: string;
  clavePublica: string;
}

/** Subir documentos y fotos al expediente desde el teléfono, la tableta o la computadora. */
export function SubirDocumentos({ expedienteId, supabaseUrl, clavePublica }: Props) {
  const cola = useColaCarga("expediente");
  const [estado, setEstado] = useState<EstadoFormulario>({});
  const [subiendo, setSubiendo] = useState(false);
  const router = useRouter();
  const pendientes = cola.cola.filter((a) => a.estado === "listo" || a.estado === "error");

  const alEnviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!pendientes.length) return setEstado({ mensaje: "Elige al menos un archivo o toma una foto." });
    setSubiendo(true);
    setEstado({});
    let correctos = 0;
    try {
      for (const item of pendientes) {
        cola.actualizar(item.id, { estado: "subiendo", progreso: 0, mensaje: undefined });
        const preparada = await accionPrepararCargaDocumento(expedienteId, item.archivo.name, item.archivo.size);
        if (!preparada.ok || !preparada.ruta || !preparada.token) {
          cola.actualizar(item.id, { estado: "error", mensaje: preparada.mensaje });
          continue;
        }
        const subida = await subirConProgreso(
          { supabaseUrl, clavePublica, bucket: "expedientes", ruta: preparada.ruta, token: preparada.token },
          item.archivo,
          (fraccion) => cola.actualizar(item.id, { progreso: fraccion }),
        );
        if (!subida.ok) {
          await accionCancelarCargaDocumento(expedienteId, preparada.ruta);
          cola.actualizar(item.id, { estado: "error", mensaje: `No se pudo subir: ${subida.mensaje}` });
          continue;
        }
        const confirmada = await accionConfirmarCargaDocumento(expedienteId, preparada.ruta, item.archivo.name);
        if (confirmada.ok) correctos += 1;
        cola.actualizar(item.id, { estado: confirmada.ok ? "hecho" : "error", mensaje: confirmada.mensaje });
      }
      const fallidos = pendientes.length - correctos;
      setEstado(
        fallidos
          ? { mensaje: `Subidos ${correctos} de ${pendientes.length}. ${fallidos === 1 ? "Un archivo no se pudo subir" : `${fallidos} archivos no se pudieron subir`}: revisa el motivo en la lista.` }
          : { ok: true, mensaje: `Listo: ${correctos} de ${pendientes.length} guardados en privado en este expediente.` },
      );
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <form onSubmit={alEnviar} className="space-y-3" noValidate>
      <SelectorArchivos
        destino="expediente"
        cola={cola}
        ocupado={subiendo}
        nota="PDF hasta 25 MB y fotos (JPG, PNG o WebP) hasta 10 MB cada una; hasta 20 por tanda. Se guardan en privado: solo quien tiene permiso en este expediente puede abrirlas."
      />
      <MensajeFormulario estado={estado} />
      <Boton
        type="submit"
        disabled={subiendo}
        aria-busy={subiendo || undefined}
        descripcion="Sube los archivos de la lista al almacenamiento privado del expediente. Se comprueba el tipo real de cada uno y queda registrado en la actividad."
      >
        {subiendo ? "Subiendo…" : "Subir al expediente"}
      </Boton>
    </form>
  );
}
