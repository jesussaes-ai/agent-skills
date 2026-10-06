import type { Metadata } from "next";
import { exigirAdmin } from "@/modulos/auth/sesion";
import { leerAjustes } from "@/modulos/expedientes/consultas";
import { Seccion } from "@/ui/componentes/Seccion";
import { FormularioAjustes, FormularioAviso } from "@/ui/expedientes/Ajustes";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Ajustes · Círculo Nueve" };

export default async function PaginaAjustes() {
  await exigirAdmin("/admin/ajustes");
  const ajustes = await leerAjustes();
  const aviso = ajustes.aviso as Record<string, string | null>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Ajustes</h1>
      <Seccion titulo="Retención y descargas" ayuda="ajustes">
        <FormularioAjustes retencionDias={ajustes.retencionDias} vigenciaSegundos={ajustes.vigenciaSegundos} />
      </Seccion>
      <Seccion titulo="Aviso de privacidad de los PDF" ayuda="ajustes">
        <FormularioAviso
          valores={{
            responsable: aviso.responsable,
            finalidades: aviso.finalidades,
            datosTratados: aviso.datos_tratados,
            conservacion: aviso.conservacion,
            derechos: aviso.derechos,
            contacto: aviso.contacto,
          }}
        />
      </Seccion>
    </div>
  );
}
