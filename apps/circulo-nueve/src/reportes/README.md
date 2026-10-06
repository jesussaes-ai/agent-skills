# Módulo de reportes PDF

Genera en servidor los PDF de Círculo Nueve (numerología, carta natal, cábala, tarot y lectura integral) con logotipo, descripción, pensamiento inspirador y las secciones obligatorias del prompt maestro (§2.10).

- Motor: [`@react-pdf/renderer`](https://react-pdf.org) 4.9 (MIT). Se eligió porque genera PDF vectorial en Node sin navegador headless (cabe en funciones de Vercel Hobby), usa componentes React y TypeScript como el resto de la app, incrusta fuentes y numera páginas.
- Tipografías incrustadas (SIL OFL 1.1, licencias en `fuentes/`): Cormorant Garamond (títulos y pensamientos) y Source Sans 3 (texto; subconjunto con latín extendido, flechas y figuras geométricas).
- Marca: `marca/logotipo-horizontal.png` (portada y encabezado) y `marca/emblema.png` (pie y bloque del pensamiento).

## Uso desde una ruta de servidor

```ts
// src/app/api/expedientes/[id]/reporte/route.ts (ejemplo; la ruta real la define la etapa de expedientes)
import { generarReportePdf, type DatosReporte } from "@/reportes";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // 1. Autenticar y verificar en servidor que la persona puede abrir/descargar este expediente.
  // 2. Construir DatosReporte solo con datos autorizados.
  const datos: DatosReporte = await construirDatos((await params).id);
  const pdf = await generarReportePdf(datos);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${datos.folio}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
```

`generarReportePdf` nunca debe importarse desde un componente cliente. Para numerología, `reporteDeNumerologia(resultado)` convierte la salida del motor en datos autorizados, cálculos con pasos y límites.

## Recursos en el servidor

Las fuentes y las imágenes se leen del disco con rutas desde `process.cwd()` (`recursos.ts`). `next.config.ts` las incluye en las trazas del servidor con `outputFileTracingIncludes`. No uses `new URL(…, import.meta.url)`: Turbopack lo convierte en una URL pública de `/_next/static`, no en un archivo.

La ruta real de descarga desde el expediente está en `src/app/expedientes/[id]/documentos/[documentoId]/route.ts` y la generación, en `src/modulos/expedientes/acciones.ts` (`accionGenerarPdf`).

## Muestra y pruebas

- `npm test` incluye `reportes.test.ts` (contenido editorial, proporción 80/20, adaptador y generación del PDF).
- `npm run reporte:muestra` escribe `src/reportes/demo/salida/muestra-numerologia.pdf` (ignorado por git) con datos ficticios marcados DEMOSTRACIÓN.

## Reglas editoriales

- Los pensamientos viven en `contenido/pensamientos.ts`. Solo textos propios de Círculo Nueve o citas de dominio público cotejadas con su fuente primaria y con `referencia`. Las traducciones propias se indican.
- Las interpretaciones llevan siempre etiqueta visible: tradicional o generada con IA (con proveedor y modelo).
- El aviso de privacidad lo completa el propietario; los campos vacíos se imprimen como pendientes, nunca se rellenan.
