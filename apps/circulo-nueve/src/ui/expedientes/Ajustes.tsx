"use client";

import { useActionState } from "react";
import { accionGuardarAjustes, accionGuardarAviso } from "@/modulos/expedientes/acciones";
import { BotonEnviar, Campo, ESTADO_INICIAL, MensajeFormulario } from "@/ui/auth/Campos";

export function FormularioAjustes({ retencionDias, vigenciaSegundos }: { retencionDias: number; vigenciaSegundos: number }) {
  const [estado, accion] = useActionState(accionGuardarAjustes, ESTADO_INICIAL);
  return (
    <form action={accion} className="grid gap-4 sm:grid-cols-2" noValidate>
      <Campo
        etiqueta="Conservar los documentos (días)"
        name="retencionDias"
        type="number"
        min={1}
        max={3650}
        defaultValue={String(retencionDias)}
        error={estado.errores?.retencionDias}
        nota="Al vencer, el proceso de purga borra el archivo y su registro."
      />
      <Campo
        etiqueta="Vigencia de los enlaces de descarga (segundos)"
        name="vigenciaSegundos"
        type="number"
        min={10}
        max={600}
        defaultValue={String(vigenciaSegundos)}
        error={estado.errores?.vigenciaSegundos}
        nota="Cada descarga crea un enlace temporal que caduca en este tiempo."
      />
      <div className="space-y-3 sm:col-span-2">
        <MensajeFormulario estado={estado} />
        <BotonEnviar descripcion="Guarda la retención y la vigencia de los enlaces. La retención nueva aplica a los documentos que se generen desde ahora.">
          Guardar ajustes
        </BotonEnviar>
      </div>
    </form>
  );
}

const CAMPOS_AVISO = [
  ["responsable", "Responsable (identidad y domicilio)"],
  ["finalidades", "Finalidades del tratamiento"],
  ["datosTratados", "Datos personales tratados"],
  ["conservacion", "Plazo de conservación"],
  ["derechos", "Derechos y cómo ejercerlos"],
  ["contacto", "Contacto"],
] as const;

export function FormularioAviso({ valores }: { valores: Record<string, string | null | undefined> }) {
  const [estado, accion] = useActionState(accionGuardarAviso, ESTADO_INICIAL);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {CAMPOS_AVISO.map(([nombre, etiqueta]) => (
        <Campo key={nombre} etiqueta={etiqueta} name={nombre} defaultValue={valores[nombre] ?? ""} maxLength={2000} />
      ))}
      <MensajeFormulario estado={estado} />
      <BotonEnviar descripcion="Guarda el aviso de privacidad que se imprime al final de cada PDF. Lo redacta el responsable; la app no lo completa.">
        Guardar aviso
      </BotonEnviar>
    </form>
  );
}
