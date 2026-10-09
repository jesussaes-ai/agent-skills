# Carta natal: motor, fuentes y casos de referencia

Módulo: `src/modulos/calculo/astrologia/` (cálculo puro, sin E/S). Interfaz: `src/ui/carta-natal/`.
Versión del motor `1.0.0`, reglas `carta-natal-2026.10`. Cada resultado guarda motor, efemérides, reglas, configuración, entradas y pasos.

## 1. Decisión de efemérides y licencia

| Opción | Licencia | Precisión | Encaje |
|---|---|---|---|
| Swiss Ephemeris vía `sweph` 2.10.3-8 (binding mantenido) | AGPL-3.0 o licencia profesional (CHF 700) | Referencia (≈0,001″) | Exige publicar el código de la app bajo AGPL si se ofrece por red a otras personas; módulo nativo de Node, no corre en el navegador. |
| **`astronomy-engine` 2.1.19** (Don Cross) | **MIT** | ±1′ declarado; **≤18″ medido** contra Swiss Ephemeris (1900–2050) | Sin dependencias, TypeScript, funciona en navegador y servidor (Vercel Hobby). No trae casas ni nodos: se implementan aquí con fórmulas publicadas. |

**Elegido: `astronomy-engine` (MIT).** La app es de uso personal y no comercial, pero Jesús da acceso a otras personas por red; con Swiss Ephemeris AGPL todo el código de la app tendría que publicarse bajo AGPL. La diferencia de precisión (segundos de arco) es muy inferior a la que permiten los datos de nacimiento reales: una hora redondeada al minuto ya mueve el Ascendente unos 15′.

**Swiss Ephemeris solo se usa como herramienta de desarrollo**, en `scripts/referencias-astrologia/` (paquete aparte, no se instala con la app ni se distribuye), para generar los casos de referencia. Lo que entra al repo son los números resultantes. La interfaz `MotorEfemerides` (`efemerides.ts`) permite cambiar a Swiss Ephemeris más adelante si el propietario acepta la AGPL o compra la licencia profesional.

## 2. Qué se calcula y cómo

- **Posiciones**: Sol, Luna, Mercurio a Plutón y nodo lunar. Son geocéntricas y aparentes (con tiempo de luz y aberración), referidas al equinoccio y la eclíptica verdaderos de la fecha, igual que el modo por defecto de Swiss Ephemeris. Velocidad por diferencia centrada de ±12 h; retrógrado si es negativa.
- **Nodo**: *verdadero* (osculador, a partir del vector posición × velocidad de la Luna proyectado en la eclíptica de la fecha; por defecto) o *medio* (Meeus, *Astronomical Algorithms*, ec. 47.7, más la nutación en longitud).
- **Zodiaco**: tropical por defecto. En el sideral se resta `ayanamsa media + nutación`, donde `ayanamsa media = valor en J2000 + p_A(T)`; `p_A` es la precesión general IAU 2006 (Capitaine et al. 2003). Los valores en J2000 son los de Swiss Ephemeris 2.10.03 para Lahiri, Fagan-Bradley, Raman y Krishnamurti. Coincide con Swiss Ephemeris en menos de 0,01″.
- **Casas**: el ARMC sale del tiempo sidéreo aparente de Greenwich más la longitud geográfica, y se usa la oblicuidad verdadera. Asc y MC con las fórmulas esféricas estándar.
  - Placidus (por defecto, iterativo por semiarcos).
  - Koch, Regiomontano y Campano (con las mismas construcciones que `swehouse.c`).
  - Porfirio, casas iguales y signos enteros.
- **Latitudes extremas**:
  - Más allá de `90° − oblicuidad` (≈66,56°), Placidus, Koch, Regiomontano y Campano se sustituyen por el **sistema de respaldo** configurable (Porfirio por defecto, como hace Swiss Ephemeris con Placidus y Koch), con aviso.
  - En esa zona el Ascendente se toma siempre al este del meridiano.
  - **Diferencia deliberada con Swiss Ephemeris**: esta calcula Regiomontano y Campano en zona polar intercambiando MC e IC, con lo que las casas quedan en orden inverso. Aquí se usa el respaldo para no mostrar una convención confusa.
  - En los polos (|lat| ≥ 89,9°) no se calculan casas.
- **Aspectos**:
  - Mayores, activos por defecto, con orbe: conjunción y oposición 8°, trígono y cuadratura 7°, sextil 5°.
  - Menores, inactivos por defecto: semisextil 2°, quincuncio 3°, semicuadratura 2°, sesquicuadratura 2°.
  - Todo es configurable. Se indica si cada aspecto es aplicativo o separativo. No se cuenta la relación Asc–MC.

## 3. Hora, zona horaria y lugar

- **Lugar**: catálogo GeoNames (CC BY 4.0) en `public/datos/lugares-geonames.json`, generado con `node scripts/generar-lugares.mjs`. Incluye 42 457 lugares: ciudades del mundo con ≥15 000 habitantes y de México con ≥1 000, más exónimos latinos de las ciudades con ≥200 000.
  - La búsqueda se hace **en el navegador**: el nombre del lugar no se envía a nadie.
  - Se muestra el lugar elegido con sus coordenadas, su zona horaria, el id de GeoNames (con enlace a la ficha) y la atribución.
  - Si el lugar no aparece, se pueden escribir latitud, longitud y zona IANA a mano.
- **Incertidumbre de coordenadas**: un punto de GeoNames representa toda la ciudad, así que se asume ±0,03° (menos de 100 000 hab.), ±0,08° (hasta 1 millón) o ±0,15° (más de 1 millón). Para coordenadas manuales, ±0,01°.
- **Hora local → UT**: con la tzdb IANA que trae el entorno (`Intl.DateTimeFormat`), con todo el historial: horarios de verano, abolición de 2022 en México, zonas como `America/Ciudad_Juarez` y hora media local (LMT) antes de la hora estándar.
  - Se registra la versión de la tzdb cuando el entorno la expone: Node la expone; los navegadores, no.
  - **Hora repetida** (fin del horario de verano): se pide elegir la primera o la segunda ocurrencia.
  - **Hora inexistente** (inicio del horario de verano): se explica y no se corrige sola.
  - La zona escrita en el perfil tiene prioridad sobre la del lugar, y se avisa si no coinciden.
  - Para fechas anteriores a 1970 se muestra un aviso, porque la tzdb es menos fiable en algunas regiones.
- **Rango de fechas**: de 1800 a 2100.

## 4. Precisión mostrada (no más de la que permiten los datos)

Cada punto se recalcula en varias muestras dentro de los márgenes, y se toma el intervalo resultante. Ese intervalo se amplía con un piso de ±30″, que es la exactitud del motor redondeada.

| Precisión de la hora | Margen | Casas, Asc y MC |
|---|---|---|
| Exacta | ±1 min (configurable) | Sí |
| Aproximada | ±30 min por defecto (5–120) | Sí, con rangos |
| Desconocida | Día local completo (12:00 ± 12 h) | **No**, con aviso |

Además del margen de hora, las casas, el Asc y el MC muestrean el margen de las coordenadas: el punto central y cuatro desplazamientos.

Según el ancho del intervalo, cada valor se muestra así:

| Ancho del intervalo | Cómo se muestra | Ejemplo |
|---|---|---|
| ≤ 2′ | Al minuto | `22°24′ Cáncer` |
| ≤ 2° | Aproximado, con ± | `22°24′ Cáncer (±2′)` o `≈22° Cáncer (±1°)` |
| Mayor | Rango | `entre 17° Leo y 1° Virgo` |

También se avisa cuando, dentro de los márgenes, un punto podría:

- cambiar de signo o de casa;
- pasar de directo a retrógrado o al revés (estacionario);
- entrar o salir del orbe de un aspecto (aspecto «incierto»).

## 5. Separación entre cálculo e interpretación

`ResultadoCarta` solo contiene posiciones calculadas. `interpretaciones` está en estado `pendiente`: las interpretaciones llegarán con los libros de la persona propietaria, con citas y en otro módulo. La UI lo indica con la etiqueta «Interpretación pendiente».

## 6. Casos de referencia (fuente independiente)

Los casos están en `src/modulos/calculo/astrologia/casos-referencia.json`. Se generan con `scripts/referencias-astrologia/generar.mjs`:

- **Posiciones, nodos, ayanamsas y casas**: Swiss Ephemeris 2.10.03 (`sweph`) con los archivos `sepl_18.se1` y `semo_18.se1`.
- **Hora local → UT**: Python `zoneinfo` con la tzdb 2026a del sistema operativo, que es una implementación distinta de la de ICU.

Hay 13 cartas: 11 de personas ficticias (marcadas así en el JSON) y 2 de eventos públicos.

| Caso | Qué comprueba |
|---|---|
| Ana (demo), CDMX 1990-07-15 08:30 | Caso base de la demostración |
| Tijuana 2015 | Horario de verano del Pacífico (PDT) |
| Cancún 2016 | Cambio de 2015 a UTC−5 |
| Hermosillo 1999 | Zona sin horario de verano |
| CDMX 2023 | Después de abolir el horario de verano (2022) |
| Guadalajara 1950 | Fecha anterior a 1970 |
| Buenos Aires 1985 | Hemisferio sur |
| Sídney 2004 | Horario de verano austral |
| Reikiavik 1978 (64° N) | Placidus todavía definido |
| Tromsø 1995 (69,6° N) | Respaldo polar |
| Calcuta 1975 | Cuatro ayanamsas |
| Sismo de México, 19 sep 1985, 07:17:47 hora local | Evento público (USGS: 13:17:47 UTC) |
| Lanzamiento del Apolo 11, 16 jul 1969, 09:32 EDT | Evento público (NASA: 13:32 UTC) |

Hay además 8 casos solo de zona horaria:

| Caso | Qué comprueba |
|---|---|
| Madrid, 29 oct 2000, 02:30 | Hora repetida |
| CDMX, 7 abr 2002, 02:30 | Hora inexistente |
| CDMX 1900 | Hora media local, UTC−06:36:36 |
| CDMX 1931 y 1932 | Desfases históricos |
| CDMX 2010 | Horario de verano, UTC−5 |
| Chihuahua 2023 | Cambio de 2022 |
| Ciudad Juárez, invierno 2023 | Sigue el horario de EE. UU. (MST) |

**Tolerancias declaradas**, verificadas por `referencia.test.ts`:

| Magnitud | Tolerancia | Máximo medido |
|---|---|---|
| Planetas, Sol y Luna | 30″ | 17,5″ (Neptuno) |
| Nodo medio y verdadero | 30″ | 0,1″ y 13″ |
| ARMC, Asc, MC y cúspides de los 7 sistemas | 20″ | 10,2″ (Regiomontano) |
| Ayanamsa media | 1″ | <0,01″ |
| Hora local → UT | Exacta al segundo | 0 s |

Para regenerar los casos (solo hace falta al cambiar casos o versiones):

```bash
cd scripts/referencias-astrologia && npm install
# archivos .se1 de https://github.com/aloistr/swisseph/tree/master/ephe
SE_EPHE_PATH=/ruta/a/ephe npm run generar
```

Requiere `python3` con `zoneinfo` y la tzdb del sistema.

## 7. Limitaciones conocidas y pendientes

- **No incluye** Quirón, asteroides, Lilith, partes arábigas, Vértice ni Topocéntrico, Alcabitius y otros sistemas. Quirón necesitaría efemérides de asteroides.
- La versión de la tzdb depende del navegador. Si el navegador es antiguo, puede no conocer cambios recientes (como la abolición de 2022 en México). Por eso se muestra el desfase usado, para poder comprobarlo.
- La tzdb unifica algunas zonas antes de 1970. Para fechas antiguas fuera de las grandes ciudades conviene contrastar con una fuente local.
- El catálogo no incluye localidades de menos de 15 000 habitantes fuera de México; para ellas hay que escribir las coordenadas.

## 8. Carta guardada en el expediente y PDF

**Guardar** (`src/modulos/expedientes/acciones-carta.ts`, sección «Carta natal» del expediente):

1. Requiere sesión activa, permiso `modificar` y el consentimiento `guardar_historial`. Este último lo exige la base con un disparador (error `CN001`).
2. La fecha, la hora, la precisión y la zona horaria se leen de `birth_profiles` en la base, no del navegador.
3. El lugar se resuelve en el servidor:
   - con un id de GeoNames, se busca en la copia del catálogo del servidor (`public/datos`, incluida en las trazas de Next); un id inventado se rechaza;
   - con coordenadas manuales, se validan los rangos y que la zona exista en la base IANA.
4. Los ajustes llegan como JSON y se validan con Zod (`esquemas-carta.ts`).
5. La carta se **recalcula en el servidor** y se guarda en `readings` con `sistema = carta_natal`. Se guardan `motor`, `motor_version`, `reglas_version`, el resultado completo y una huella SHA-256 (`entradas_hash`). El resultado incluye ajustes, efemérides, entradas, lugar con su fuente, zona, desfase, UT y versión de la tzdb de Node. La huella (`huella-carta.ts`) cubre las entradas, la zona, la ocurrencia, los ajustes y las versiones de motor, reglas, efemérides y tzdb, así que dos cartas con la misma huella son reproducibles entre sí.

**PDF**: «Generar PDF» en una carta guardada usa `reporteDeCartaNatal` (`src/reportes/adaptadores/carta-natal.ts`), con el diseño, la portada, los pensamientos y el aviso de privacidad del módulo de reportes. El reporte incluye:

- **Datos autorizados**: fecha, hora y precisión, lugar con coordenadas y fuente, zona y desfase, y UT.
- **Conversión de la hora**, paso a paso.
- **Rueda** vectorial.
- **Tablas** de posiciones, cúspides y aspectos.
- **Límites**: exactitud del motor, tzdb y todos los avisos de precisión de la carta.

Las interpretaciones siguen vacías hasta que haya fuentes. La muestra ficticia está en `src/reportes/demo/muestra-carta-natal.ts`.
