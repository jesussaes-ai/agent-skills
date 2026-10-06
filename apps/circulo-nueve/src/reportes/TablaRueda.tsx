import { Circle, G, Line, Path, Svg, Text as SvgText, Text, View } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { COLORES as C, TIPOGRAFIA as T } from "./tema";
import type { RuedaReporte, TablaReporte } from "./tipos";

const s = StyleSheet.create({
  bloque: { marginBottom: 12 },
  titulo: { fontFamily: T.titulos, fontSize: T.tamanos.h2, fontWeight: 600, marginBottom: 2 },
  nota: { fontSize: T.tamanos.pequeno, color: C.pizarra, marginBottom: 4 },
  cabecera: { flexDirection: "row", backgroundColor: C.marino, color: C.doradoClaro, paddingVertical: 4, paddingHorizontal: 4 },
  celdaCabecera: { fontSize: T.tamanos.micro + 0.5, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" },
  fila: { flexDirection: "row", paddingVertical: 3.5, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: C.linea },
  filaPar: { backgroundColor: C.blanco },
  celda: { fontSize: T.tamanos.pequeno + 0.5, paddingRight: 4 },
  rueda: { alignItems: "center", marginBottom: 12 },
  pieRueda: { fontSize: T.tamanos.pequeno, color: C.pizarra, marginTop: 4, textAlign: "center", maxWidth: 360 },
});

export function TablaPdf({ tabla }: { tabla: TablaReporte }) {
  const anchos = tabla.anchos ?? tabla.columnas.map(() => 1);
  const total = anchos.reduce((a, b) => a + b, 0);
  const ancho = (i: number) => `${(anchos[i] / total) * 100}%`;
  return (
    <View style={s.bloque}>
      <View wrap={false} minPresenceAhead={60}>
        <Text style={s.titulo}>{tabla.titulo}</Text>
        {tabla.nota ? <Text style={s.nota}>{tabla.nota}</Text> : null}
        <View style={s.cabecera}>
          {tabla.columnas.map((c, i) => (
            <Text key={c} style={[s.celdaCabecera, { width: ancho(i) }]}>
              {c}
            </Text>
          ))}
        </View>
      </View>
      {tabla.filas.map((fila, n) => (
        <View key={n} style={[s.fila, n % 2 === 0 ? s.filaPar : {}]} wrap={false}>
          {fila.map((v, i) => (
            <Text key={i} style={[s.celda, { width: ancho(i) }]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const SIGNOS = ["Ar", "Ta", "Ge", "Ca", "Le", "Vi", "Li", "Es", "Sa", "Cp", "Ac", "Pi"];
const TAM = 250;
const CEN = TAM / 2;

export function RuedaPdf({ rueda }: { rueda: RuedaReporte }) {
  const giro = rueda.ascendente ?? 0;
  const xy = (lon: number, r: number) => {
    const a = ((180 + lon - giro) * Math.PI) / 180;
    return { x: CEN + r * Math.cos(a), y: CEN - r * Math.sin(a) };
  };
  const arco = (desde: number, hasta: number, r: number) => {
    const ancho = (((hasta - desde) % 360) + 360) % 360;
    const p1 = xy(desde, r);
    const p2 = xy(desde + ancho, r);
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${ancho > 180 ? 1 : 0} 0 ${p2.x} ${p2.y}`;
  };
  const ordenados = [...rueda.puntos].sort((a, b) => a.longitud - b.longitud);
  const radio = new Map<string, number>();
  ordenados.forEach((p, i) => {
    const previo = ordenados[i - 1];
    const cerca = previo && p.longitud - previo.longitud < 8;
    radio.set(p.abreviatura, cerca && radio.get(previo.abreviatura) === 80 ? 64 : 80);
  });

  return (
    <View style={s.rueda} wrap={false}>
      <Svg width={TAM} height={TAM} viewBox={`0 0 ${TAM} ${TAM}`}>
        <Circle cx={CEN} cy={CEN} r={120} fill={C.pergamino} stroke={C.dorado} strokeWidth={1.2} />
        <Circle cx={CEN} cy={CEN} r={100} fill={C.blanco} stroke={C.linea} strokeWidth={0.8} />
        <Circle cx={CEN} cy={CEN} r={46} fill={C.marfil} stroke={C.linea} strokeWidth={0.6} />
        {SIGNOS.map((nombre, i) => {
          const a = xy(i * 30, 120);
          const b = xy(i * 30, 100);
          const t = xy(i * 30 + 15, 110);
          return (
            <G key={nombre}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={C.dorado} strokeWidth={0.6} />
              <SvgText x={t.x - 5} y={t.y + 3} style={{ fontSize: 7.5, fontFamily: T.texto }} fill={C.doradoTexto}>
                {nombre}
              </SvgText>
            </G>
          );
        })}
        {rueda.cuspides?.map((c, i) => {
          const a = xy(c, 100);
          const b = xy(c, 46);
          const n = xy(c + 5, 52);
          const angular = i % 3 === 0;
          return (
            <G key={i}>
              <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={angular ? C.marino : C.linea} strokeWidth={angular ? 1.1 : 0.6} />
              <SvgText x={n.x - 2.5} y={n.y + 2} style={{ fontSize: 5.5, fontFamily: T.texto }} fill={C.pizarra}>
                {String(i + 1)}
              </SvgText>
            </G>
          );
        })}
        {rueda.puntos.map((p) => {
          const r = radio.get(p.abreviatura)!;
          const t = xy(p.longitud, r);
          const m1 = xy(p.longitud, 99);
          const m2 = xy(p.longitud, 93);
          return (
            <G key={p.abreviatura}>
              {p.rango ? (
                <Path d={arco(p.rango.desde, p.rango.hasta, 96)} stroke={C.dorado} strokeWidth={3} fill="none" />
              ) : (
                <Line x1={m1.x} y1={m1.y} x2={m2.x} y2={m2.y} stroke={C.marino} strokeWidth={1} />
              )}
              <SvgText x={t.x - 5} y={t.y + 3} style={{ fontSize: 7.5, fontFamily: T.texto, fontWeight: 600 }} fill={C.marino}>
                {p.abreviatura}
              </SvgText>
            </G>
          );
        })}
      </Svg>
      <Text style={s.pieRueda}>{rueda.pie}</Text>
    </View>
  );
}
