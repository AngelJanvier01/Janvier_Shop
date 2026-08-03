# JANVIER — Auditoría de estabilidad de producción

Fecha de validación: 2026-07-31. Alcance: estabilidad del tema, logotipo, responsive,
consola y carga de producción. No se modificó la dirección visual aprobada.

## Causas raíz y correcciones

### Logotipo del header

El monograma del header se pintaba mediante una máscara CSS externa (`mask: url(...)`) sobre
un `span`. Ese recurso externo era el único mecanismo de pintura del logo y podía quedar sin
repintar de manera fiable tras cambios rápidos de color/tema. No se encontró una `key` de React
basada en tema ni desmontaje intencional del componente, pero la ruta de render era frágil.

`BrandMark` ahora es el SVG oficial inline con `fill="currentColor"`: no cambia de `src`, no se
desmonta al alternar el tema y reserva su proporción. La regla base fija `opacity: 1` y
`visibility: visible`; la animación del monograma también termina en opacidad 1.

### Cambio de tema

El selector ahora lee el tema actual directamente desde `html[data-theme]` antes de calcular el
siguiente. Así, pulsaciones consecutivas no dependen de un cierre de React desactualizado. El
atributo se actualiza primero, se persiste de forma protegida en `localStorage` y se emite un
evento único para los suscriptores. Los listeners de `storage` y del evento propio se limpian al
desmontar.

El bootstrap de tema se conserva en `head`: la elección explícita guardada precede a la
preferencia del sistema y se aplica a `<html>` antes del primer render de la aplicación. No hay
keys de React basadas en tema.

### Overflow horizontal

La incidencia reproducible era de 592 px de `scrollWidth` en un viewport de 320 px. La causa
principal no era un decorativo oculto: las secciones interiores cambiaban a `grid-template-columns:
1fr` en móvil. El mínimo automático de esa pista permitía que una lista mantuviera un ancho
intrínseco de 576 px. Se reemplazó por `minmax(0, 1fr)` y el contenedor hijo recibió `min-width: 0`.

También se protegen las etiquetas técnicas largas con `overflow-wrap: anywhere`, y los medios
reciben `max-width: 100%`. No se usó `overflow-x: hidden` como solución.

### Warnings de consola

- El preload de CSS era generado por Next para el error boundary: `app/error.tsx` y
  `app/not-found.tsx` importaban un CSS module exclusivo que la ruta normal no consumía pronto.
  Sus estilos se trasladaron al stylesheet global ya crítico. La prueba productiva en un Chromium
  limpio ya no registra el warning.
- No hay uso propio de `chrome.runtime`, `browser.runtime`, service workers ni `postMessage` en
  el código auditado. El mensaje `Unchecked runtime.lastError` no se reprodujo en el perfil limpio
  de Playwright; si aparece únicamente en un navegador con extensiones, se clasifica como externo
  a la aplicación.
- `output: "standalone"` requiere copiar manualmente `public/` y `.next/static/` junto al
  servidor trazado. La imagen Docker ya lo hacía, pero el comando local no: el servidor podía
  devolver HTML sin CSS, JavaScript o imágenes. `npm run start` ahora prepara esas carpetas antes
  de iniciar el mismo `server.js` standalone; la validación productiva reproduce la imagen real.

## Automatización añadida

`tests/e2e/stability.spec.ts` valida sobre producción:

- 50 cambios neutral/night y 20 recargas alternando la preferencia persistida;
- logo, header, opacidad, visibilidad, dimensiones y ausencia de overflow después de cada cambio;
- 176 combinaciones: 8 rutas × 2 temas × 11 viewports;
- menú móvil abierto/cerrado 10 veces, incluido foco final y reduced motion;
- warnings y errores de consola durante el estrés del tema.

`tests/visual/record-theme-stress.ts` genera video y capturas móviles. `tests/visual/audit-production.ts`
guarda una instantánea de recursos y métricas locales de producción.

## Resultado de la validación

Comandos ejecutados correctamente:

```text
npm run check
npm run test
npm run build
npm run test:e2e:production
```

La última ejecución de Playwright concluyó `13 passed` en 30.9 s. La matriz cubrió:

```text
320×568, 360×800, 375×812, 390×844, 414×896, 768×1024,
1024×768, 1280×720, 1366×768, 1440×900 y 1920×1080
```

La auditoría local con `next start`, viewport 1440×900 y perfil Chromium limpio registró:

| Medida                                               |      Resultado |
| ---------------------------------------------------- | -------------: |
| Scroll document / viewport                           | 1440 / 1440 px |
| CLS observado                                        |              0 |
| LCP observado                                        |          76 ms |
| Máxima duración de evento observada al alternar tema |          32 ms |
| Recursos duplicados                                  |              0 |
| Problemas de consola                                 |              0 |

Son medidas de laboratorio local y no sustituyen RUM de usuarios reales; sirven como línea base
repetible para esta rama.

## Evidencia generada

Los archivos reproducibles no se versionan y se escriben en `artifacts/stability/`:

- `mobile-neutral.png`
- `mobile-night.png`
- `page@c112c5501ce5e9b8b626d7bbd4c81e1e.webm`
- `production-audit.json`
