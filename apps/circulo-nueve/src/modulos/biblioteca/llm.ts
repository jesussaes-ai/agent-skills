/**
 * Punto de conexión entre el bot de la biblioteca y la capa de proveedores LLM
 * (`src/proveedores/`, la mantiene otro equipo). La biblioteca solo necesita
 * `LlmProvider` de `@/modulos/proveedores/tipos`; el contrato está en
 * docs/contrato-proveedores-biblioteca.md. Sin proveedor, el bot responde en
 * modo extractivo (citas literales, sin enviar nada fuera).
 */
import type { LlmProvider } from "@/modulos/proveedores/tipos";

let proveedor: LlmProvider | null = null;

export function registrarLlmBiblioteca(nuevo: LlmProvider | null): void {
  proveedor = nuevo;
}

export function llmBiblioteca(): LlmProvider | null {
  return proveedor;
}
