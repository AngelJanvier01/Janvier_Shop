# JANVIER V2 — Notas de seguridad activas

## Dependencia bloqueante para producción

**Detectado:** 2026-07-31  
**Comando:** npm audit --omit=dev  
**Estado:** no resuelto por una actualización compatible.

La versión estable instalada de Next.js 16.2.12 hereda tres avisos de severidad alta:

- PostCSS: salida CSS y source maps controlados por contenido no confiable.
- Sharp: vulnerabilidades heredadas de libvips.

La única corrección que npm propone es forzar Next.js 9.3.3, un retroceso mayor e inseguro que no es una solución válida. No se aplicó.

## Mitigación temporal

- La V2 no procesa CSS aportado por usuarios.
- La V2 no acepta todavía cargas de imágenes o archivos.
- No hay despliegue público ni procesamiento de imágenes remotas configurado.
- Se debe ejecutar npm audit antes de cada despliegue.
- Se actualizará Next.js en cuanto exista una versión compatible que resuelva los avisos.

## Regla de lanzamiento

No desplegar la V2 a producción con estos avisos activos sin revisar la recomendación oficial de Next.js, el alcance real de las vulnerabilidades y una mitigación aprobada.
