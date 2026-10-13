import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Configuración aparte para que `npm test` no escriba archivos.
export default defineConfig({
  root: fileURLToPath(new URL("../../..", import.meta.url)),
  resolve: {
    alias: { "@": fileURLToPath(new URL("../..", import.meta.url)) },
  },
  test: {
    include: ["src/reportes/demo/generar-muestra.muestra.ts"],
    environment: "node",
  },
});
