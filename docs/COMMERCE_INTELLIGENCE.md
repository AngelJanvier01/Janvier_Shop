# Inteligencia comercial y recuperación

La tienda tiene dos fuentes complementarias de señales comerciales: carritos y fichas de producto. Ambas viven en PostgreSQL, sin píxeles de terceros.

## Carritos abandonados

`/admin/carritos-abandonados` muestra listas activas que tienen al menos una partida y no se han modificado durante 2 horas, 24 horas o 7 días. La ventana inicial es 24 horas.

- Cada alta, cambio de cantidad, retiro de partida o restauración toca la actividad del carrito. No se infiere abandono por la fecha en que se creó.
- Las listas que pasan a cotización salen de la bandeja y su recuperación queda como `CONVERTED`.
- Un administrador puede marcar `OPEN`, `CONTACTED` o `DISMISSED` y dejar una nota interna. El enlace de correo abre el cliente local; no dispara campañas ni mensajes automáticos.
- Se muestran el valor estimado con IVA, las partidas, la empresa y el contacto propietario.

El envío automático de recordatorios queda deliberadamente fuera hasta definir consentimiento, frecuencia, plantilla, remitente y un proveedor de correo apropiado.

## Señales por producto

`/admin/analitica` contiene el bloque **Interés por producto** con las últimas 30 jornadas:

- Vista de ficha, una vez por producto y sesión de pestaña.
- Recorrido completo de galería, únicamente cuando la persona selecciona manualmente todas las imágenes de una galería con dos o más imágenes.
- Descarga de ficha técnica PDF.
- Alta en una lista comercial o carrito.

La tabla prioriza fichas por vistas, avance de galería, PDF y altas a lista. Cada fila lleva a un detalle con el embudo de la ficha, sesiones únicas y las cuentas comerciales identificadas que tuvieron actividad reciente. Las visitas de personas no autenticadas permanecen agregadas.

También se puede abrir el detalle desde una ficha administrativa publicada con **Ver señales**.

## Privacidad y retención

No se persisten IP, user-agent, contraseña, contenido de formularios, parámetros de URL ni identificadores persistentes de navegador. La sesión de pestaña aleatoria se transforma con HMAC-SHA-256 antes de guardarse.

Una cuenta se muestra por nombre, empresa y correo sólo cuando ya inició sesión en una cuenta comercial aprobada. Esto permite seguimiento B2B sin intentar identificar visitantes anónimos.

La tarea existente conserva 90 días de ambas familias de eventos:

```powershell
npm run analytics:prune
npm run analytics:prune -- --apply
```

Programa la segunda orden semanal o mensualmente en el servidor, junto con los respaldos de PostgreSQL.
