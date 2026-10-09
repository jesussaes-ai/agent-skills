import type { NextConfig } from "next";

const CABECERAS_SEGURIDAD = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // El dictado del asistente usa el micrófono de esta misma página; nada más.
  { key: "Permissions-Policy", value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Modelos locales (ONNX), OCR y DOM de servidor: se cargan de node_modules sin empaquetar.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "tesseract.js", "linkedom", "sharp"],
  experimental: {
    // Centro de carga: hasta 25 MB por archivo (en Vercel el límite de la petición es menor; ver docs/biblioteca.md).
    serverActions: { bodySizeLimit: "26mb" },
  },
  // Archivos que el servidor lee del disco: fuentes e imágenes del PDF y el catálogo de lugares.
  async headers() {
    return [
      { source: "/:ruta*", headers: CABECERAS_SEGURIDAD },
      // El token del enlace va en la URL: no se envía como referente ni se indexa.
      {
        source: "/compartido/:ruta*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
  outputFileTracingIncludes: {
    "/*": ["src/reportes/fuentes/**/*", "src/reportes/marca/**/*", "public/datos/**/*"],
  },
};

export default nextConfig;
