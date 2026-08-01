# PageHero system — JANVIER

**Estado:** implementado para revisión visual  
**Fecha:** 2026-07-31

`PageHero` es el único sistema de hero para Estudio, Soluciones, Proyectos, Suministro, Laboratorio, Acerca y Contacto. Las rutas sólo entregan etiqueta, título, descripción y variante de longitud.

## Contrato

```tsx
<PageHero
  label="SECTION / TECHNICAL_LABEL"
  title="Título sin saltos manuales"
  description="Descripción editorial"
  titleSize="short | medium | long"
/>
```

El componente controla el contenedor, dos columnas, panel técnico, retícula, línea `signal`, indicador `phosphor`, divisor, ritmo vertical, animaciones y responsive.

## Tokens

```css
--header-height-desktop: 92px;
--header-height-mobile: 68px;
--hero-padding-top: clamp(4rem, 7vw, 7.5rem);
--hero-padding-bottom: clamp(4.5rem, 7vw, 8rem);
--hero-label-gap: clamp(1rem, 1.6vw, 1.5rem);
--hero-description-gap: clamp(1.75rem, 3vw, 2.75rem);
```

## Variantes de título

| Variante | Uso                     | Máximo | Escala desktop |
| -------- | ----------------------- | -----: | -------------- |
| `short`  | Declaraciones compactas |  8.5ch | 4.5–9.5rem     |
| `medium` | Título editorial normal |  9.5ch | 4–9rem         |
| `long`   | Declaraciones extensas  | 10.5ch | 3.5–7.5rem     |

Los títulos usan `text-wrap: balance`; no se añaden saltos de línea para ajustar una sola captura.

## Movimiento y accesibilidad

- La secuencia inicial compartida de etiqueta, título, descripción, panel, retícula, línea e indicador termina en 1.02 segundos. El título se revela desde un contenedor máscara, sin saltos manuales ni deformación.
- Neutral y night usan la misma secuencia, duraciones y easing. Sólo cambian los tokens visuales.
- Con `prefers-reduced-motion: reduce`, las animaciones no esenciales quedan neutralizadas globalmente.
- Las secciones y CTAs usan una entrada basada en `animation-timeline: view()` cuando el navegador la soporta; el contenido permanece visible como fallback.

## Verificación visual

```bash
npm run capture:page-heroes
```

El comando comprueba header, espacio vertical, divisor, columna visual, overflow y navegación a 1280, 1366, 1440 y 1920px; también genera las comparativas de Estudio y Soluciones para desktop y móvil, en neutral y night.
