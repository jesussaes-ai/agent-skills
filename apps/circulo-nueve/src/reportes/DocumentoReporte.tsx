import { Document, Image, Page, Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { DESCRIPCIONES } from "./contenido/descripciones";
import { pensamientoDe } from "./contenido/pensamientos";
import { estilos as e } from "./estilos";
import { calcularProporcion, formatearLocalizador } from "./proporcion";
import { EMBLEMA, LOGOTIPO } from "./recursos";
import { PAGINA } from "./tema";
import type { AvisoPrivacidad, Cita, DatosReporte, Interpretacion, Pensamiento } from "./tipos";

const AUTOR = "Círculo Nueve";
const SECCIONES = ["Datos autorizados", "Cálculos paso a paso", "Interpretación", "Límites de precisión", "Fuentes citadas", "Aviso de privacidad"];

export function formatearFecha(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d} de ${meses[m - 1]} de ${a}`;
}

function Ornamento() {
  return (
    <View style={e.ornamento}>
      <View style={e.ornamentoLinea} />
      <View style={e.ornamentoRombo} />
      <View style={e.ornamentoLinea} />
    </View>
  );
}

function MarcaAgua() {
  return (
    <View style={e.marcaAgua} fixed>
      <Text style={e.marcaAguaTexto}>DEMOSTRACIÓN</Text>
    </View>
  );
}

function BloquePensamiento({ p }: { p: Pensamiento }) {
  const detalle = [p.obra, p.referencia].filter(Boolean).join(" · ");
  return (
    <View style={e.panelPensamiento}>
      <Image src={EMBLEMA} style={e.pensamientoEmblema} />
      <Text style={e.pensamientoTexto}>«{p.texto}»</Text>
      <Text style={e.pensamientoAutor}>— {p.autor}</Text>
      {p.origen === "dominio-publico" ? (
        <Text style={e.pensamientoRef}>
          {detalle}
          {p.traduccion ? ` · ${p.traduccion}` : ""}
        </Text>
      ) : null}
    </View>
  );
}

function Portada({ datos, pensamiento }: { datos: DatosReporte; pensamiento: Pensamiento }) {
  const info = DESCRIPCIONES[datos.tipo];
  return (
    <Page size={PAGINA.tamano} style={e.portada}>
      <View style={e.marcoExterior}>
        <View style={e.marcoInterior}>
          <Image src={LOGOTIPO} style={e.portadaLogo} />
          <Ornamento />
          <Text style={e.portadaTipo}>{datos.titulo || info.nombre}</Text>
          <Text style={e.portadaNombre}>{datos.nombrePersona}</Text>
          <Text style={e.portadaLema}>{datos.subtitulo ?? info.lema}</Text>
          <Text style={e.portadaDescripcion}>{datos.descripcion ?? info.descripcion}</Text>
          <View style={e.portadaMeta}>
            <Meta etiqueta="Fecha de elaboración" valor={formatearFecha(datos.fechaElaboracion)} />
            <Meta etiqueta="Folio" valor={datos.folio} />
            <Meta etiqueta="Tradición" valor={datos.tradicion} />
          </View>
          <View style={e.indice}>
            <Text style={e.metaEtiqueta}>En este reporte</Text>
            <View style={e.indiceLista}>
              {SECCIONES.map((s, i) => (
                <View key={s} style={e.indiceItem}>
                  <Text style={e.indiceNum}>{i + 1}</Text>
                  <Text style={e.indiceTexto}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
          <BloquePensamiento p={pensamiento} />
        </View>
      </View>
      {datos.demostracion ? <Text style={e.cintaDemo}>DEMOSTRACIÓN · DATOS FICTICIOS</Text> : null}
    </Page>
  );
}

function Meta({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={e.metaBloque}>
      <Text style={e.metaEtiqueta}>{etiqueta}</Text>
      <Text style={e.metaValor}>{valor}</Text>
    </View>
  );
}

function Encabezado({ datos }: { datos: DatosReporte }) {
  return (
    <View style={e.encabezado} fixed>
      <Image src={LOGOTIPO} style={e.encabezadoLogo} />
      <View>
        <Text style={e.encabezadoTexto}>{datos.titulo || DESCRIPCIONES[datos.tipo].nombre}</Text>
        <Text style={e.encabezadoTexto}>{datos.nombrePersona}</Text>
      </View>
    </View>
  );
}

function Pie({ datos }: { datos: DatosReporte }) {
  return (
    // Con `render`, react-pdf redibuja el pie en cada página; con hijos estáticos los descarta al caer en el margen inferior.
    <View
      style={e.pie}
      fixed
      // Los tipos de View omiten totalPages, pero react-pdf lo entrega igual que en Text.
      render={({ pageNumber, totalPages }: { pageNumber: number; totalPages?: number }) => (
        <>
          <Text>
            Folio {datos.folio} · Documento personal y confidencial{datos.demostracion ? " · DEMOSTRACIÓN" : ""}
          </Text>
          <Image src={EMBLEMA} style={e.pieEmblema} />
          <Text>
            Página {pageNumber} de {totalPages}
          </Text>
        </>
      )}
    />
  );
}

function Seccion({
  n,
  titulo,
  intro,
  children,
  nuevaPagina,
  indivisible,
}: {
  n: number;
  titulo: string;
  intro?: string;
  children: ReactNode;
  nuevaPagina?: boolean;
  indivisible?: boolean;
}) {
  return (
    <View style={e.seccion} break={nuevaPagina} wrap={!indivisible}>
      <View style={e.seccionCabecera} wrap={false} minPresenceAhead={90}>
        <Text style={e.seccionNumero}>{n}</Text>
        <Text style={e.seccionTitulo}>{titulo}</Text>
      </View>
      {intro ? <Text style={e.seccionIntro}>{intro}</Text> : null}
      {children}
    </View>
  );
}

function Vineta({ children }: { children: ReactNode }) {
  return (
    <View style={e.vineta}>
      <Text style={e.vinetaPunto}>◆</Text>
      <Text style={e.vinetaTexto}>{children}</Text>
    </View>
  );
}

function Etiqueta({ origen }: { origen: Interpretacion["origen"] }) {
  return origen === "ia" ? (
    <Text style={[e.etiqueta, e.etiquetaIa]}>GENERADO CON IA</Text>
  ) : (
    <Text style={[e.etiqueta, e.etiquetaTradicional]}>INTERPRETACIÓN TRADICIONAL</Text>
  );
}

function referenciaCita(c: Cita, indice: Map<string, number>): string {
  const loc = formatearLocalizador(c.localizador);
  const tipo = c.tipo === "textual" ? "cita textual" : c.tipo === "parafrasis" ? "paráfrasis" : "síntesis";
  return `[${indice.get(c.fuenteId)}${loc ? `, ${loc}` : ""} · ${tipo}]`;
}

const CAMPOS_AVISO: { clave: keyof AvisoPrivacidad; etiqueta: string }[] = [
  { clave: "responsable", etiqueta: "Responsable" },
  { clave: "finalidades", etiqueta: "Finalidades" },
  { clave: "datosTratados", etiqueta: "Datos tratados" },
  { clave: "conservacion", etiqueta: "Conservación" },
  { clave: "derechos", etiqueta: "Derechos y cómo ejercerlos" },
  { clave: "contacto", etiqueta: "Contacto" },
];

export function DocumentoReporte({ datos }: { datos: DatosReporte }) {
  const pensamiento = pensamientoDe(datos.tipo, datos.pensamientoId);
  const proporcion = calcularProporcion(datos);
  const indice = new Map(datos.fuentes.map((f, i) => [f.id, i + 1]));
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  let n = 0;

  return (
    <Document
      title={`${datos.titulo || DESCRIPCIONES[datos.tipo].nombre} — ${datos.nombrePersona}`}
      author={AUTOR}
      creator={AUTOR}
      producer={AUTOR}
      language="es-MX"
      subject={datos.demostracion ? "DEMOSTRACIÓN con datos ficticios" : DESCRIPCIONES[datos.tipo].nombre}
    >
      <Portada datos={datos} pensamiento={pensamiento} />

      <Page size={PAGINA.tamano} style={e.pagina} wrap>
        {datos.demostracion ? <MarcaAgua /> : null}
        <Encabezado datos={datos} />
        <Pie datos={datos} />

        <Seccion n={++n} titulo="Datos autorizados" intro="Solo aparecen los datos que la persona autorizó usar para esta lectura. No se infirió ni completó ningún dato faltante.">
          <View style={e.tabla}>
            {datos.datosAutorizados.map((d) => (
              <View key={d.etiqueta} style={e.fila} wrap={false}>
                <Text style={e.celdaEtiqueta}>{d.etiqueta}</Text>
                <View style={e.celdaValor}>
                  <Text>{d.valor}</Text>
                  {d.nota ? <Text style={e.pequeno}>{d.nota}</Text> : null}
                </View>
              </View>
            ))}
            <View style={e.fila} wrap={false}>
              <Text style={e.celdaEtiqueta}>Tradición y reglas</Text>
              <Text style={e.celdaValor}>
                {datos.tradicion}
                {datos.versionReglas ? ` · reglas ${datos.versionReglas}` : ""}
              </Text>
            </View>
          </View>
        </Seccion>

        <Seccion n={++n} titulo="Cálculos paso a paso" intro="Cada resultado muestra las operaciones realizadas para que puedas verificarlo.">
          {datos.calculos.map((c) => (
            <View key={c.titulo} style={e.tarjeta} wrap={false}>
              <View style={e.tarjetaCabecera}>
                <Text style={e.numeroCirculo}>{c.valor}</Text>
                <View style={{ flex: 1 }}>
                  {c.destacado ? <Text style={e.destacado}>{c.destacado}</Text> : null}
                  <Text style={e.h2}>{c.titulo}</Text>
                  {c.subtitulo ? <Text style={e.pequeno}>{c.subtitulo}</Text> : null}
                </View>
              </View>
              {c.pasos.map((p, i) => (
                <View key={i} style={e.paso}>
                  <Text style={e.pasoNum}>{i + 1}.</Text>
                  <Text style={e.pasoDesc}>{p.descripcion}</Text>
                  <Text style={e.pasoOp}>{p.operacion}</Text>
                </View>
              ))}
            </View>
          ))}
        </Seccion>

        <Seccion
          n={++n}
          titulo="Interpretación"
          intro="Lecturas simbólicas para la reflexión, no predicciones ni diagnósticos. Cada bloque indica si proviene de la tradición documentada o si fue generado con inteligencia artificial."
          nuevaPagina
        >
          {datos.interpretaciones.map((it) => (
            <View key={it.titulo} style={[e.tarjeta, it.origen === "ia" ? e.bordeIa : e.bordeTradicional]} wrap={false}>
              <View style={e.tarjetaCabecera}>
                <Etiqueta origen={it.origen} />
                {it.generadoPor ? <Text style={e.pequeno}>{it.generadoPor}</Text> : null}
              </View>
              <Text style={e.h2}>{it.titulo}</Text>
              {it.parrafos.map((p, i) => (
                <Text key={i} style={e.parrafo}>
                  {p}
                </Text>
              ))}
              {it.citas.length ? (
                <Text style={e.cita}>Fuentes: {it.citas.map((c) => referenciaCita(c, indice)).join(" ")}</Text>
              ) : (
                <Text style={e.cita}>Sin respaldo en fuentes cargadas: interpretación general.</Text>
              )}
              {it.preguntas?.map((q) => (
                <Text key={q} style={e.pregunta}>
                  {q}
                </Text>
              ))}
            </View>
          ))}
        </Seccion>

        <Seccion n={++n} titulo="Límites de precisión" indivisible>
          <View style={e.cajaAviso}>
            {datos.limites.map((l) => (
              <Vineta key={l}>{l}</Vineta>
            ))}
          </View>
        </Seccion>

        <Seccion n={++n} titulo="Fuentes citadas" intro="Cada fragmento citado se cuenta una sola vez, aunque aparezca en varias interpretaciones.">
          <View wrap={false}>
            {proporcion.total ? (
              <>
                <Text>
                  Fuentes aportadas por el propietario: {proporcion.aportadas} de {proporcion.total} fragmentos ({pct(proporcion.proporcionAportadas!)}) · complementarias:{" "}
                  {proporcion.complementarias} · objetivo editorial: {pct(proporcion.objetivo)} aportadas.
                </Text>
                <View style={e.barra}>
                  <View style={[e.barraAportadas, { width: `${proporcion.proporcionAportadas! * 100}%` }]} />
                  <View style={[e.barraComplementarias, { width: `${(1 - proporcion.proporcionAportadas!) * 100}%` }]} />
                </View>
                <View style={e.leyenda}>
                  <View style={e.leyendaItem}>
                    <View style={[e.leyendaMuestra, e.barraAportadas]} />
                    <Text>Aportadas</Text>
                  </View>
                  <View style={e.leyendaItem}>
                    <View style={[e.leyendaMuestra, e.barraComplementarias]} />
                    <Text>Complementarias</Text>
                  </View>
                  <Text>{proporcion.cumpleObjetivo ? "Cumple el objetivo editorial." : "No alcanza el objetivo editorial: faltan fuentes aportadas."}</Text>
                </View>
              </>
            ) : (
              <Text>Esta lectura no cita fuentes de la biblioteca; las interpretaciones son generales.</Text>
            )}
          </View>
          <View style={{ marginTop: 10 }}>
            {datos.fuentes.map((f, i) => (
              <View key={f.id} style={e.fuente} wrap={false}>
                <Text style={e.fuenteNum}>[{i + 1}]</Text>
                <Text style={{ flex: 1 }}>
                  {[f.autor, f.titulo, f.edicion, f.referencia]
                    .filter(Boolean)
                    .map((s) => s!.replace(/\.$/, ""))
                    .join(". ")}
                  {f.fechaConsulta ? `. Consultado el ${formatearFecha(f.fechaConsulta)}` : ""}.{" "}
                  <Text style={e.pequeno}>({f.grupo === "aportada" ? "aportada por el propietario" : "complementaria"})</Text>
                </Text>
              </View>
            ))}
          </View>
        </Seccion>

        <Seccion
          n={++n}
          titulo="Aviso de privacidad"
          indivisible
          intro="Contenido proporcionado por el propietario de la aplicación. Círculo Nueve no completa estos campos ni afirma cumplimiento legal alguno."
        >
          <View style={e.tabla}>
            {CAMPOS_AVISO.map(({ clave, etiqueta }) => {
              const valor = datos.avisoPrivacidad[clave]?.trim();
              return (
                <View key={clave} style={e.fila} wrap={false}>
                  <Text style={e.celdaEtiqueta}>{etiqueta}</Text>
                  <Text style={[e.celdaValor, valor ? {} : e.campoVacio]}>{valor || "Pendiente: lo completa el propietario."}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[e.pregunta, e.cierre]}>Gracias por darte este tiempo para mirarte con calma.</Text>
        </Seccion>
      </Page>
    </Document>
  );
}
