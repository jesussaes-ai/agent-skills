import { ErrorProveedor } from "./cliente-openai";
import { estimarCostoUsd, estimarTokens, estimarTokensSolicitud, evaluarLimites, type MotivoLimite } from "./limites";
import { PLANTILLAS } from "./catalogo";
import type { CodigoResultado, ConfigProveedor, RegistroConsumo, RegistroUso, RespuestaLlm, SolicitudLlm } from "./tipos";

export interface Candidato {
  proveedor: ConfigProveedor;
  modelo: string;
  llave?: string;
}

/** Resumen apto para mostrar o registrar: sin contenido de la solicitud. */
export interface ResumenIntento {
  proveedorId: string;
  modelo: string;
  codigo: CodigoResultado;
  intento: number;
  esperaMs?: number;
  motivoLimite?: MotivoLimite;
}

export interface OpcionesRespaldo {
  llamar: (candidato: Candidato, solicitud: SolicitudLlm) => Promise<RespuestaLlm>;
  registroDe: (proveedor: ConfigProveedor) => RegistroConsumo;
  origen: RegistroUso["origen"];
  usuarioId?: string | null;
  esperar?: (ms: number) => Promise<void>;
  ahora?: () => number;
  baseEsperaMs?: number;
  /** Si el proveedor pide esperar más que esto, se pasa al siguiente candidato. */
  maxEsperaMs?: number;
  /** Tiempo total para todos los intentos. */
  presupuestoMs?: number;
}

export interface ResultadoRespaldo {
  respuesta: RespuestaLlm;
  candidato: Candidato;
  intentos: ResumenIntento[];
  /** true si respondió un candidato distinto del primero. */
  huboRespaldo: boolean;
}

export class ErrorSinRespuesta extends Error {
  constructor(readonly intentos: ResumenIntento[]) {
    super("Ningún proveedor respondió.");
    this.name = "ErrorSinRespuesta";
  }

  /** Código más representativo para explicar el fallo a la persona. */
  get codigo(): CodigoResultado {
    const codigos = this.intentos.map((i) => i.codigo);
    for (const c of ["limite_429", "limite_local", "credito", "autorizacion", "sin_llave", "tiempo", "servidor", "red"] as const) {
      if (codigos.includes(c)) return c;
    }
    return codigos.at(-1) ?? "servidor";
  }
}

/** Candidatos en orden: modelo principal, modelos alternos y luego otros proveedores por prioridad. */
export function ordenarCandidatos(principal: ConfigProveedor, respaldos: ConfigProveedor[], llaveDe: (p: ConfigProveedor) => string | undefined): Candidato[] {
  const proveedores = [principal, ...respaldos.filter((p) => p.id !== principal.id).sort((a, b) => a.prioridad - b.prioridad)];
  return proveedores.flatMap((p) => [p.modelo, ...p.modelosAlternos].map((modelo) => ({ proveedor: p, modelo, llave: llaveDe(p) })));
}

const esperarReal = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Intenta cada candidato con reintentos y espera exponencial ante 429/5xx,
 * respetando Retry-After. Registra cada intento sin el contenido.
 */
export async function completarConRespaldo(candidatos: Candidato[], solicitud: SolicitudLlm, op: OpcionesRespaldo): Promise<ResultadoRespaldo> {
  const ahora = op.ahora ?? Date.now;
  const esperar = op.esperar ?? esperarReal;
  const base = op.baseEsperaMs ?? 500;
  const maxEspera = op.maxEsperaMs ?? 8000;
  const limite = ahora() + (op.presupuestoMs ?? 25000);
  const intentos: ResumenIntento[] = [];
  const descartados = new Set<string>();
  const tokensEntradaEstimados = estimarTokensSolicitud(solicitud);

  const registrar = async (c: Candidato, r: Omit<RegistroUso, "proveedorId" | "modelo" | "origen" | "usuarioId">) => {
    try {
      await op.registroDe(c.proveedor).registrar({ proveedorId: c.proveedor.id, modelo: c.modelo, origen: op.origen, usuarioId: op.usuarioId ?? null, ...r });
    } catch {
      // Un fallo del registro no debe tumbar la respuesta.
    }
  };

  for (const [indice, c] of candidatos.entries()) {
    if (descartados.has(c.proveedor.id)) continue;
    if (PLANTILLAS[c.proveedor.tipo].requiereLlave && !c.llave) {
      intentos.push({ proveedorId: c.proveedor.id, modelo: c.modelo, codigo: "sin_llave", intento: 0 });
      descartados.add(c.proveedor.id);
      continue;
    }

    for (let intento = 1; intento <= c.proveedor.limites.reintentos + 1; intento++) {
      if (ahora() >= limite) throw new ErrorSinRespuesta(intentos);
      const uso = await op.registroDe(c.proveedor).uso(c.proveedor.id);
      const costoMaximo = estimarCostoUsd(c.proveedor.costo, tokensEntradaEstimados, c.proveedor.limites.maxTokensSalida);
      const motivo = evaluarLimites(c.proveedor.limites, uso, costoMaximo);
      if (motivo) {
        intentos.push({ proveedorId: c.proveedor.id, modelo: c.modelo, codigo: "limite_local", intento, motivoLimite: motivo });
        descartados.add(c.proveedor.id);
        break;
      }

      const inicio = ahora();
      try {
        const respuesta = await op.llamar(c, solicitud);
        const tokensEntrada = respuesta.tokensEntrada ?? tokensEntradaEstimados;
        const tokensSalida = respuesta.tokensSalida ?? estimarTokens(respuesta.texto);
        const costo = respuesta.costoUsd ?? estimarCostoUsd(c.proveedor.costo, tokensEntrada, tokensSalida);
        await registrar(c, { codigoResultado: "ok", intento, latenciaMs: ahora() - inicio, tokensEntrada, tokensSalida, costoEstimadoUsd: costo });
        intentos.push({ proveedorId: c.proveedor.id, modelo: c.modelo, codigo: "ok", intento });
        return { respuesta: { ...respuesta, proveedor: respuesta.proveedor ?? c.proveedor.nombre }, candidato: c, intentos, huboRespaldo: indice > 0 };
      } catch (e) {
        const error = e instanceof ErrorProveedor ? e : new ErrorProveedor("red");
        await registrar(c, { codigoResultado: error.codigo, intento, latenciaMs: ahora() - inicio });
        const espera = error.esperaMs ?? base * 2 ** (intento - 1);
        intentos.push({ proveedorId: c.proveedor.id, modelo: c.modelo, codigo: error.codigo, intento, esperaMs: error.reintentable ? espera : undefined });
        if (error.codigo === "autorizacion" || error.codigo === "credito") {
          descartados.add(c.proveedor.id);
          break;
        }
        const quedan = intento <= c.proveedor.limites.reintentos;
        if (!error.reintentable || !quedan || espera > maxEspera || ahora() + espera >= limite) break;
        await esperar(espera);
      }
    }
  }
  throw new ErrorSinRespuesta(intentos);
}
