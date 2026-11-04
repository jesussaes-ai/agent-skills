import type { Metadata } from "next";
import { NuevaConsulta } from "@/ui/consulta/NuevaConsulta";

export const metadata: Metadata = { title: "Nueva consulta · Círculo Nueve" };

export default function PaginaConsulta() {
  return <NuevaConsulta />;
}
