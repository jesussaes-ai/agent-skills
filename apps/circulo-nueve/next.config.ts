import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Modelos locales (ONNX), OCR y DOM de servidor: se cargan de node_modules sin empaquetar.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "tesseract.js", "linkedom", "sharp"],
  experimental: {
    // Centro de carga: hasta 25 MB por archivo (en Vercel el límite de la petición es menor; ver docs/biblioteca.md).
    serverActions: { bodySizeLimit: "26mb" },
  },
  // Fuentes e imágenes que el generador de PDF lee del disco en el servidor.
  outputFileTracingIncludes: {
    "/*": ["src/reportes/fuentes/**/*", "src/reportes/marca/**/*"],
  },
};

export default nextConfig;
