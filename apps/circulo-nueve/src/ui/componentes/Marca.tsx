import Image from "next/image";
import emblema from "@/assets/marca/circulo-nueve-emblema.png";
import logotipo from "@/assets/marca/circulo-nueve-logotipo-horizontal.png";

export function Logotipo() {
  return (
    <Image
      src={logotipo}
      alt="Círculo Nueve: emblema circular azul marino con nueve esferas doradas junto al nombre de la aplicación"
      priority
      sizes="204px"
      className="h-14 w-auto"
    />
  );
}

/** Emblema oficial (sin letras) como icono decorativo junto a textos de navegación. */
export function Emblema({ tamano = 18 }: { tamano?: number }) {
  return <Image src={emblema} alt="" aria-hidden width={tamano} height={tamano} className="shrink-0" />;
}
