import "server-only";
import { clienteSupabaseAdmin, clienteSupabaseServidor } from "@/modulos/auth/supabase-servidor";
import { hashToken, esTokenValido } from "./token";

export interface EnlaceCompartido {
  id: string;
  alcance: "documento" | "expediente";
  documentoId: string | null;
  nota: string | null;
  creadoEl: string;
  venceEl: string;
  revocadoEl: string | null;
  accesos: number;
  maxAccesos: number | null;
  ultimoAcceso: string | null;
}

/** Enlaces del expediente, visibles para quien puede compartirlo (RLS). */
export async function listarEnlaces(expedienteId: string): Promise<EnlaceCompartido[]> {
  const supabase = await clienteSupabaseServidor();
  const { data } = await supabase
    .from("share_links")
    .select("id, alcance, document_id, nota, created_at, expires_at, revoked_at, accesos, max_accesos, ultimo_acceso_at")
    .eq("case_file_id", expedienteId)
    .order("created_at", { ascending: false });
  return (data ?? []).map((e) => ({
    id: e.id,
    alcance: e.alcance,
    documentoId: e.document_id,
    nota: e.nota,
    creadoEl: e.created_at,
    venceEl: e.expires_at,
    revocadoEl: e.revoked_at,
    accesos: e.accesos,
    maxAccesos: e.max_accesos,
    ultimoAcceso: e.ultimo_acceso_at,
  }));
}

export interface DocumentoCompartido {
  id: string;
  nombre: string;
  creado: string;
  tamano: number | null;
  ruta: string;
}

export type ResultadoEnlace =
  | {
      estado: "ok";
      alcance: "documento" | "expediente";
      vence: string;
      nota: string | null;
      accesos: number;
      maxAccesos: number | null;
      documentos: DocumentoCompartido[];
    }
  | { estado: "no_existe" | "vencido" | "revocado" | "agotado" | "documento_no_disponible" };

/**
 * Uso público de un enlace (sin sesión). El servidor calcula el hash y llama a
 * la función de la base con la llave de servicio; ella valida vigencia, revocación
 * y máximo de accesos, y audita cada intento.
 */
export async function usarEnlace(token: string, documentoId: string | null, origen: string | null): Promise<ResultadoEnlace> {
  if (!esTokenValido(token)) return { estado: "no_existe" };
  const { data, error } = await clienteSupabaseAdmin().rpc("usar_enlace_compartido", {
    p_token_hash: hashToken(token),
    p_documento: documentoId,
    p_origen: origen,
  });
  if (error || !data) return { estado: "no_existe" };
  return data as ResultadoEnlace;
}
