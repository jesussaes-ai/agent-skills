import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Archivos que el servidor lee del disco: fuentes e imágenes del PDF y el catálogo de lugares.
  outputFileTracingIncludes: {
    "/*": ["src/reportes/fuentes/**/*", "src/reportes/marca/**/*", "public/datos/**/*"],
  },
};

export default nextConfig;
