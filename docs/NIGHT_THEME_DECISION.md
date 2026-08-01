# Night theme — JANVIER

**Estado:** implementado para revisión visual  
**Fecha:** 2026-07-31

El tema night conserva la estructura, jerarquía y tipografía del tema neutral. Cambia el sistema de superficie para comunicar una interfaz tecnológica activa, no una inversión plana de colores.

## Tokens obligatorios

```css
--bg: #0d0f0c;
--bg-subtle: #11140f;
--surface: #151913;
--surface-raised: #1b2019;

--text: #eeeae1;
--text-muted: #aaa99f;
--text-soft: #7f837b;

--signal: #d64d38;
--phosphor: #789183;
```

`phosphor` queda reservado para foco técnico, estados, indicadores y metadatos activos. No es un color decorativo general.

## Reglas aplicadas

- Las secciones alternan `bg`, `bg-subtle`, `surface` y `surface-raised`.
- `HUMAN_RESPONSIBILITY` conserva una superficie de marfil cálido, incluso en night.
- El hero incorpora cuadrícula técnica con contraste moderado, iluminación radial tenue detrás del monograma, línea `signal`, coordenadas y un estado del sistema.
- La entrada del hero dura como máximo 1.25 segundos y sólo anima opacidad y transform. Con `prefers-reduced-motion: reduce` se elimina visualmente.
- El SVG se consume sin filtros ni deformación geométrica.
- No hay azul neón, morado, glow fuerte, gradientes saturados ni sombras exteriores de texto.
- La preferencia se aplica desde `ThemeBootstrap` antes del primer render; las transiciones sólo corren cuando el usuario no solicitó movimiento reducido.

## Comprobación de contraste

Las combinaciones de texto y foco usadas en night superan WCAG AA para texto normal:

| Par                       | Contraste | Resultado |
| ------------------------- | --------: | --------- |
| `#eeeae1` sobre `#0d0f0c` |   16.04:1 | AA        |
| `#aaa99f` sobre `#0d0f0c` |    8.15:1 | AA        |
| `#7f837b` sobre `#0d0f0c` |    4.98:1 | AA        |
| `#789183` sobre `#151913` |    5.23:1 | AA        |
| `#d64d38` sobre `#0d0f0c` |    4.56:1 | AA        |

## Capturas de revisión

Con el servidor local en `http://127.0.0.1:3001`:

```bash
npm run capture:themes
```

El comando entrega las cuatro capturas completas de página, sin animación, para hacer la comparación estable:

```text
artifacts/night-comparison/desktop-neutral.png
artifacts/night-comparison/desktop-night.png
artifacts/night-comparison/mobile-neutral.png
artifacts/night-comparison/mobile-night.png
```
