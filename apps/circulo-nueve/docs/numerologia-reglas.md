# Numerología pitagórica — reglas del motor

Motor `circulo-nueve/numerologia-pitagorica` v1.0.0 · reglas `pitagorica-es-1`.
Código: `src/modulos/calculo/numerologia/`. Pruebas: `numerologia.test.ts`.

Estas son **convenciones por defecto y configurables**. La tradición definitiva se fijará con los libros que aporte el propietario; si cambia una regla, sube `REGLAS_VERSION`.

## Tabla

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|
| A | B | C | D | E | F | G | H | I |
| J | K | L | M | N | O | P | Q | R |
| S | T | U | V | W | X | Y | Z |   |

## Normalización del nombre

| Caso | Regla | Configurable |
|---|---|---|
| Mayúsculas/minúsculas | No importan. | No |
| Acentos, diéresis, cedilla (á, ü, ç…) | Se quitan: á→A, ü→U, ç→C. Se registra cada cambio. | No |
| Ñ | Cuenta como N (valor 5) por defecto, o se rechaza con aviso. | `enye`: `como-n` / `rechazar` |
| Espacios y guiones | Separan palabras (nombres compuestos: «Jean-Luc» = JEAN + LUC). | No |
| Apóstrofos y puntos | Se ignoran sin separar («O'Brien» = OBRIEN). | No |
| Letras no latinas (griego, hebreo, cirílico, ß, æ…) | Se rechazan con aviso; no se transcriben automáticamente. | No |
| Dígitos y símbolos | Se rechazan con aviso. | No |
| Y | Consonante por defecto, o siempre vocal. | `y`: `consonante` / `vocal` |
| Vocales | A, E, I, O, U (+ Y si así se configura). | vía `y` |

Nada se adivina ni completa: si falta el nombre o la fecha, no se calculan los indicadores que lo necesitan y se avisa.

## Reducción y números maestros

Se suman los dígitos hasta llegar a 1–9. Con `numerosMaestros: true` (por defecto) la reducción se detiene en cuanto un resultado, inicial o intermedio, está en `maestros` (por defecto 11, 22, 33). Cada operación queda como un paso visible, por ejemplo `57 → 5 + 7 = 12`, `12 → 1 + 2 = 3`.

## Indicadores

| Indicador | Datos | Método por defecto | Alternativa |
|---|---|---|---|
| Camino de vida | Fecha AAAA-MM-DD (fecha real del calendario) | `por-componentes`: reducir día, mes y año por separado, sumar y reducir | `suma-de-digitos`: sumar todos los dígitos y reducir |
| Expresión (destino) | Todas las letras del nombre de nacimiento | `total`: sumar todas las letras y reducir | `por-palabra`: reducir cada palabra, sumar y reducir |
| Alma | Vocales | igual que expresión | igual |
| Personalidad | Consonantes | igual que expresión | igual |

Los ciclos y otros indicadores no se calculan hasta que se definan sus reglas.

Cada resultado incluye motor, versión, tradición, versión de reglas, configuración completa, nombre normalizado, cambios aplicados, advertencias y pasos.

## Casos de referencia (personas ficticias)

Definidos en `casos-referencia.ts` y verificados a mano:

| Caso | Entradas | Esperado |
|---|---|---|
| Acentos y ñ | Ana María Núñez, 1990-07-15 | camino 5 · expresión 3 · alma 3 · personalidad 9 |
| Por palabra | Ana María Núñez | expresión 3 (7 + 6 + 8 = 21 → 3) |
| Maestro 22 | Gina | expresión 22 · alma 1 · personalidad 3 |
| Maestros desactivados | Gina | expresión 4 |
| Maestro 11 en fecha | 1980-01-01 | camino 11 (1 + 1 + 9) |
| Suma de dígitos | 1980-01-01 | camino 2 (20 → 2) |
| Y consonante | Yolanda | expresión 9 · alma 8 · personalidad 1 |
| Y vocal | Yolanda | expresión 9 · alma 6 · personalidad 3 |

Además hay pruebas basadas en propiedades (`fast-check`): valores siempre en 1–9 o maestros activos; expresión ≡ alma + personalidad (mód. 9); resultado independiente de mayúsculas y acentos; determinismo.
