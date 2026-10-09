import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Círculo Nueve",
    short_name: "Círculo Nueve",
    description: "Explora numerología, carta natal y cábala como sistemas simbólicos de reflexión personal.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ef",
    theme_color: "#0f1b33",
    icons: [
      { src: "/iconos/emblema-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/iconos/emblema-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/iconos/emblema-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
