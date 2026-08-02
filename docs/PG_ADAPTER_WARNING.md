# Seguimiento técnico — JANVIER-V2-OBS-001

## Advertencia de `pg` bajo carga de pruebas

### Mensaje exacto

```text
DeprecationWarning: Calling client.query() when the client is already executing
a query is deprecated and will be removed in pg@9.0. Use async/await or an
external async flow control mechanism instead.
```

### Condiciones para reproducirlo

1. Ejecutar `PROJECT_ROOM_E2E=1 npm run test:e2e:production`.
2. Mantener la configuración paralela de Playwright (14 workers en la máquina
   de validación).
3. Observar la salida del proceso `next start` que Playwright levanta en
   `127.0.0.1:3002`.

La advertencia no apareció en la ejecución serial de Project Room con seis
pruebas de producción.

### Evaluación actual

El mensaje procede de la capa de cliente PostgreSQL (`pg`) bajo concurrencia y
no de una excepción de una action de Project Room. La migración se aplica sin
errores, el build es correcto y las pruebas de Project Room pasan. Por eso no
bloquea esta entrega, pero tampoco se considera una consola completamente
limpia.

No se oculta ni se captura: se mantiene visible para que una actualización de
`pg` o `@prisma/adapter-pg` no convierta la deprecación en un fallo silencioso.

### Vigilancia

- Ejecutar la suite de producción en cada actualización de Prisma, su
  adaptador PostgreSQL o `pg`.
- Fallar la validación si el mensaje evoluciona a error, se acompaña de fallos
  de consulta o aparecen inconsistencias de datos.
- Reproducir con `node --trace-deprecation` en una rama de mantenimiento antes
  de modificar el pool o el adaptador.

### Issue de seguimiento

Identificador local: `JANVIER-V2-OBS-001`.

Título propuesto para GitHub: `chore(db): trace pg concurrent client.query
deprecation under parallel Playwright load`.

No se publicó un issue remoto durante este cierre: el entorno no tiene `gh` ni
un token de GitHub configurado. Al disponer de credenciales, publicar este
contenido en el repositorio `AngelJanvier01/Janvier_Shop` y sustituir este
identificador por el enlace del issue.
