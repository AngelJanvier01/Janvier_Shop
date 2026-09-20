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

# Nota de build

Mientras JANVIER usa `next@16.3.0-canary.106` por la corrección de dependencias
de producción, el script `npm run build` fija `--webpack`. El Turbopack de ese
canary falla al empaquetar algunos endpoints con módulos `node:`; webpack
termina el build correctamente. Se debe retirar esta compatibilidad al migrar a
una versión estable de Next que incluya la misma corrección de seguridad.

# Endurecimiento de comercio y solicitudes - 2026-09-19

- Los límites de inicio de sesión, altas, pagos, cargas y acciones sensibles
  viven en PostgreSQL (`RequestRateLimit`), con incremento atómico. Funcionan
  igual aunque haya más de una instancia web y se podan con
  `npm run security:prune`.
- Las claves de rate limit son SHA-256 de la acción, actor e identidad de red;
  no persisten correo ni IP en claro. `TRUST_PROXY_CLIENT_IP` queda en `false`
  por defecto. Sólo se activa si el proxy de producción elimina y reconstruye
  los headers de reenvío antes de llegar a Next.
- El alta de clientes incluye mismo origen, rate limiting, un campo trampa y un
  tiempo mínimo de interacción. Responde de forma genérica a bots para no darles
  un oráculo de validación.
- Las imágenes públicas son derivados locales aprobados, no URLs directas de
  SICODD. La fuente se conserva sólo para sincronización y reprocesamiento.
- El CSP continúa permitiendo la fuente SICODD exclusivamente para previsualizar
  y administrar importaciones internas. No debe retirarse hasta que esas vistas
  administrativas usen el mismo proxy local.
