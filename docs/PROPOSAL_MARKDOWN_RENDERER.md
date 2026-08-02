# Renderer estructurado de propuestas JANVIER

Estado: Hito C implementado para `ADMIN` y `ADMIN_PREVIEW`.

## Frontera de seguridad

La única entrada del renderer es `JanvierDocument` validado por
`janvierDocumentSchema`, o uno de sus DTOs derivados:

```text
sourceMarkdown
  -> parseJanvierMarkdown
  -> JanvierDocumentAst validado
  -> buildAdminJanvierDocument / buildPublicJanvierDocument
  -> JanvierMarkdownRenderer
  -> React controlado
```

El renderer no acepta `sourceMarkdown`, MDAST, HAST, HTML ni registros de
Prisma. No utiliza `dangerouslySetInnerHTML`. Al abrir una propuesta se vuelve
a validar `normalizedAst`; si no pasa el esquema se reanaliza sólo en el
servidor. Si tampoco es válido, el panel se bloquea con un error de integridad.

`JanvierDocumentRenderError` bloquea nodos o directivas que no pertenezcan al
registro cerrado. La frontera es deliberadamente más estricta que una vista de
Markdown genérica: una forma JSON correcta no basta para ejecutar un nodo no
registrado.

## DTOs y privacidad

`buildAdminJanvierDocument` conserva información útil para la revisión:

- secciones públicas, internas y excluidas;
- marcador `PUBLIC`, `INTERNAL` o `EXCLUDED`;
- rango de líneas de la fuente;
- directiva `janvier-internal` claramente señalada.

`buildPublicJanvierDocument` crea un objeto distinto y con allowlist. Excluye
antes de React las secciones `internalOnly`, las no incluidas, las retiradas de
la revisión y cada `janvier-internal`. No transporta `sourceMarkdown`, líneas
de fuente, `internalOnly`, costos, proveedor, notas, hashes de invitación ni
rutas de almacenamiento. La prueba serializa el DTO para verificar esas
ausencias.

Los modos `CLIENT` y `PRINT` existen en el tipo y usan el mismo DTO público,
pero no se exponen todavía por ruta ni por Project Room.

## Registro visual

El registro cubre documento, secciones, bloques CommonMark/GFM, listas y
tareas, enlaces, bloque de cita, código, tablas, notas, activos por alias y
las seis directivas JANVIER:

- `janvier-callout`
- `janvier-metrics`
- `janvier-decision`
- `janvier-ascii`
- `janvier-page-break`
- `janvier-internal`

Los enlaces de ruta interna usan `Link`; los enlaces externos seguros se abren
con `noopener noreferrer`. `asset:alias` representa un panel técnico, sin
descargar, resolver ni subir archivos en este hito. Las variables se resuelven
desde un contexto cerrado; una variable ausente se muestra de forma visible y
las variables estructurales `proposal.options` y `proposal.timeline` se
representan como placeholders, no como cálculo comercial.

Una variable escapada (`\{{variable}}`) se conserva literalmente, incluso si
comparte párrafo con una variable que sí se resuelve.

## Administración

La página de detalle de propuesta contiene `RENDERED_DOCUMENT / SAFE_AST`:

- la vista principal es `ADMIN_PREVIEW / PUBLIC_ONLY`;
- el inspector plegable usa el DTO `ADMIN` y señala líneas, secciones internas
  y excluidas;
- no modifica la fuente, su estado, el Project Room ni el modelo comercial;
- el cambio neutral/night sólo cambia tokens CSS: no vuelve a analizar la
  fuente, no reconstruye el DTO ni reinicia el scroll.

El documento usa tipografía del sistema JANVIER, retícula tenue, signal y
phosphor según los tokens existentes. Tablas y código se contienen mediante
contenedores con scroll local; el documento no crea overflow horizontal.

## Accesibilidad y rendimiento

- HTML semántico para encabezados, listas, citas, tablas y bloques de código.
- El índice usa anclas y los destinos reservan `scroll-margin` para el header.
- La tabla permite foco y desplazamiento horizontal local en pantallas
  estrechas.
- El contenido sigue presente sin esperar animación ni JavaScript.
- No se aplican filtros, canvas, HTML sin sanitizar ni efectos de scroll.
- La prueba unitaria genera 10,000 nodos y exige renderizado estático en menos
  de cinco segundos; es una defensa de regresión, no una promesa de hardware.

## Validación del Hito C

La cobertura incluye:

- transformación pública/admin y ausencia serializada de campos internos;
- registro cerrado y error controlado ante nodo desconocido;
- CommonMark, GFM, tareas, tabla, enlaces, código, activos placeholder y las
  directivas JANVIER;
- variables conocidas, faltantes y escapadas;
- fixture de 10,000 nodos;
- E2E opcional con contenido interno, viewport móvil, ausencia de overflow y
  cincuenta cambios de tema sin desmontar el documento.

Los comandos de cierre son `npm run check`, `npm run build`,
`npm run test:e2e:production` con `PROJECT_ROOM_E2E=1` y el build Docker.
Para evidencia visual, con la aplicación iniciada, ejecutar
`npm run capture:proposal-markdown-renderer`; genera desktop y móvil para
neutral/night en `artifacts/proposal-markdown-renderer/`.

## Fuera de alcance

Hito C no incorpora activos privados ni upload, conceptos económicos,
cronograma comercial, congelación al compartir, hashes duales, integración con
Project Room, snapshots Markdown, PDF, CRM, pagos ni DOCX. Esas capacidades
requieren aprobación del siguiente hito y usarán este renderer compartido.
