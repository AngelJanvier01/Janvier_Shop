# JANVIER V2 - notas activas de seguridad

## Actualizacion de dependencias - 2026-08-02

El hallazgo anterior de tres vulnerabilidades altas esta remediado en el
candidato de lanzamiento actual. JANVIER fija exactamente `next` y
`eslint-config-next` en `16.3.0-canary.106`. Ese grafo usa
`postcss@8.5.23` y `sharp@0.35.3`.

Validacion realizada contra este `package-lock.json`:

- `npm audit --omit=dev`: cero vulnerabilidades.
- `npm run check`: correcto.
- `npm run build`: correcto.
- `npm run test:e2e:production`: 34 pruebas activas correctas; una prueba de
  catalogo se omite deliberadamente por su feature flag.

## Regla operativa

La correccion disponible antes del proximo release estable de Next 16.x es un
canary. Se mantiene fijado exactamente: no actualizar `next`,
`eslint-config-next` ni el lockfile por intuicion. Cualquier cambio requiere
audit limpio, checks, build y E2E de produccion completos.

En cuanto Next publique un release estable con PostCSS y Sharp corregidos, se
debe actualizar en una rama dedicada y repetir esta validacion. Si este canary
presenta un error de runtime en produccion, se revierte el despliegue y no se
restaura el grafo vulnerable anterior.
