import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/modulos/auth/sesion";
import { obtenerExpediente } from "@/modulos/expedientes/consultas";
import { NOMBRE_PERMISO, PERMISOS_EXPEDIENTE } from "@/modulos/expedientes/esquemas";
import { EnlaceBoton } from "@/ui/componentes/EnlaceBoton";
import { Etiqueta, Seccion } from "@/ui/componentes/Seccion";
import { ListaDocumentos } from "@/ui/expedientes/Documentos";
import {
  FormularioBorrarExpediente,
  FormularioConsentimientos,
  FormularioEditarExpediente,
  FormularioPerfil,
  FormularioVincularCliente,
} from "@/ui/expedientes/Formularios";
import type { ResultadoCarta } from "@/modulos/calculo/astrologia";
import { CartaExpediente } from "@/ui/carta-natal/CartaExpediente";
import { HistorialLecturas, NuevaLectura } from "@/ui/expedientes/Lecturas";
import { PermisosExpediente } from "@/ui/expedientes/Permisos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expediente · Círculo Nueve" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function PaginaExpediente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await exigirSesion(`/expedientes/${id}`);
  if (!UUID.test(id)) notFound();
  const detalle = await obtenerExpediente(sesion, id);
  if (!detalle) notFound();

  const { expediente, permisos, perfil, consentimientos, lecturas, documentos, administracion } = detalle;
  const puedeModificar = permisos.modificar;
  const consentidoPerfil = consentimientos.guardar_perfil?.otorgado === true;
  const consentidoHistorial = consentimientos.guardar_historial?.otorgado === true;
  const ultimaCarta = lecturas.find((l) => l.sistema === "carta_natal")?.resultado as ResultadoCarta | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <EnlaceBoton href="/expedientes" className="px-0" descripcion="Vuelve a la lista de expedientes.">
          ← Expedientes
        </EnlaceBoton>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{expediente.etiqueta}</h1>
        {expediente.esDemo && <Etiqueta tono="ambar">Datos ficticios de demostración</Etiqueta>}
      </div>

      <Seccion titulo="Resumen y tus permisos" ayuda="expedientes">
        <p className="mb-3 text-sm text-slate-700">
          Tus permisos aquí:{" "}
          <span data-testid="mis-permisos">
            {PERMISOS_EXPEDIENTE.filter((p) => permisos[p]).map((p) => NOMBRE_PERMISO[p]).join(", ") || "ninguno"}
          </span>
          .
        </p>
        {puedeModificar && <FormularioEditarExpediente id={id} etiqueta={expediente.etiqueta} />}
        {administracion && (
          <div className="mt-4">
            <FormularioVincularCliente id={id} clienteId={expediente.clienteId} personas={administracion.personas} />
          </div>
        )}
      </Seccion>

      <Seccion titulo="Consentimientos" ayuda="expediente-consentimientos">
        <FormularioConsentimientos id={id} vigentes={consentimientos} editable={puedeModificar} />
      </Seccion>

      <Seccion titulo="Perfil de nacimiento" ayuda="expediente-perfil">
        <FormularioPerfil id={id} perfil={perfil} editable={puedeModificar} consentido={consentidoPerfil} />
      </Seccion>

      <Seccion titulo="Nueva lectura de numerología" ayuda="expediente-lecturas">
        <NuevaLectura id={id} nombre={perfil?.nombreNacimiento ?? ""} fecha={perfil?.fecha ?? ""} puedeGuardar={puedeModificar} consentido={consentidoHistorial} />
      </Seccion>

      <Seccion titulo="Carta natal" ayuda="expediente-carta-natal">
        {perfil?.fecha ? (
          <CartaExpediente
            id={id}
            datos={{
              fecha: perfil.fecha,
              hora: perfil.hora,
              precisionHora: perfil.precisionHora,
              lugarTexto: perfil.lugar,
              zonaHoraria: perfil.zonaHoraria,
              esDemo: false,
            }}
            lugarInicial={ultimaCarta?.entradas.lugar ?? null}
            puedeGuardar={puedeModificar}
            consentido={consentidoHistorial}
          />
        ) : (
          <p className="text-slate-700">Guarda primero la fecha de nacimiento en el perfil para calcular la carta natal.</p>
        )}
      </Seccion>

      <Seccion titulo="Historial de lecturas" ayuda="expediente-lecturas">
        <HistorialLecturas id={id} lecturas={lecturas} puedeBorrar={permisos.borrar} puedeDescargar={permisos.abrir_descargar} />
      </Seccion>

      <Seccion titulo="Documentos" ayuda="expediente-documentos">
        <ListaDocumentos
          id={id}
          documentos={documentos}
          puedeBorrar={permisos.borrar}
          usuarioId={sesion.usuarioId}
          administracion={administracion ? { personas: administracion.personas, asignacionesArchivo: administracion.asignacionesArchivo } : null}
        />
      </Seccion>

      {administracion && (
        <Seccion titulo="Permisos del expediente" ayuda="expediente-permisos">
          <PermisosExpediente
            id={id}
            asignaciones={administracion.asignaciones}
            personas={administracion.personas.filter((p) => p.id !== sesion.usuarioId)}
          />
        </Seccion>
      )}

      {administracion && (
        <Seccion titulo="Actividad registrada" ayuda="expediente-permisos">
          {administracion.auditoria.length ? (
            <ol className="space-y-1 text-sm text-slate-700" data-testid="auditoria">
              {administracion.auditoria.map((e, i) => (
                <li key={i}>
                  {new Date(e.fecha).toLocaleString("es-MX")} · {e.actor} · {e.accion} · {e.recurso}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-600">Sin actividad registrada.</p>
          )}
        </Seccion>
      )}

      <Seccion titulo="Exportar o borrar" ayuda="expediente-exportar-borrar">
        <div className="space-y-5">
          {permisos.abrir_descargar && (
            <EnlaceBoton
              href={`/expedientes/${id}/exportar`}
              prefetch={false}
              className="px-0"
              descripcion="Descarga en JSON el perfil, los consentimientos, las lecturas y la lista de documentos de este expediente. Queda registrado."
            >
              Exportar expediente (JSON)
            </EnlaceBoton>
          )}
          {permisos.borrar && <FormularioBorrarExpediente id={id} />}
        </div>
      </Seccion>
    </div>
  );
}
