import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Fuentes e imágenes que el generador de PDF lee del disco en el servidor.
  outputFileTracingIncludes: {
    "/*": ["src/reportes/fuentes/**/*", "src/reportes/marca/**/*"],
  },
};

export default nextConfig;
