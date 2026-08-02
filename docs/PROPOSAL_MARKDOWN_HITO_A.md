# Proposal Studio — Hito A

**Commit objetivo:** `feat(proposals): add markdown source domain and parser`
**Estado:** implementado.
**No incluido:** UI de carga/pegado, activos, renderer público, preview
administrativa, variables resueltas, hashes de aceptación Markdown, Project
Room Markdown, PDF, CRM y pagos.

## Dominio incorporado

```text
AdminUser ──< ProposalMarkdownSource >── ProposalRevision ──< ProposalSection
     │                    │                       │
     └──< MarkdownCheckpoint                 sourceId / slug / AST
                          │
                          └── IMPORT, RESTORE, PRE_SHARE, REVISION_CLONED…
```

- `ProposalMarkdownSource` es único por revisión y conserva fuente, SHA-256,
  parser, estado de parse, cache AST y procedencia.
- `ProposalMarkdownCheckpoint` deja historia secuencial por fuente.
- `ProposalSection` suma `sourceId`, `slug`, `contentAst`, `internalOnly`,
  líneas de fuente y `removedAt`. Sus CUID existentes no cambian.
- Se ampliaron de forma aditiva los tipos de sección requeridos por el
  dialecto. `CONDITIONS` se interpreta como `TERMS` para compatibilidad.

Las referencias/blobs de activos y los hashes duales siguen diseñados en
[PROPOSAL_STUDIO_MARKDOWN_FIRST.md](./PROPOSAL_STUDIO_MARKDOWN_FIRST.md), pero
se implementarán sólo en Hitos D y H respectivamente.

## Migración y backfill

Migración: `20260802020000_proposal_markdown_source`.

1. Crea enums de estado y razón de checkpoint.
2. Agrega columnas compatibles a `ProposalSection`, llena
   `legacy-<section.id>` y activa índices únicos por revisión.
3. Crea tablas de fuente/checkpoint y sus relaciones con revisión y
   administrador.
4. Genera una fuente `legacy-generated.md` por cada revisión existente:

```md
# Título de revisión

## Contexto {#legacy-<section-id> type=CONTEXT}

Contenido existente.
```

5. Calcula el SHA-256 con `pgcrypto` y crea un checkpoint `IMPORT`. No altera
   propuesta, estado, invitaciones, line items, aceptación ni hashes previos.

### Evidencia de validación

| Escenario                             | Resultado                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Base vacía `janvier_hito_a_empty`     | Las seis migraciones aplicaron; la segunda ejecución de `prisma migrate deploy` no encontró pendientes.            |
| Base previa `janvier_hito_a_existing` | Una revisión con dos secciones recibió una fuente y un checkpoint `IMPORT`; ambas secciones obtuvieron `legacy-…`. |
| Integridad del backfill               | `1 revisión / 1 fuente / 1 checkpoint / 0 secciones incompletas / 0 hashes inválidos`.                             |
| Base local existente                  | La migración se aplicó correctamente; no había revisiones históricas que convertir.                                |

Las bases temporales de validación no contienen datos de usuario y se eliminan
al finalizar la prueba.

## Gramática implementada

- CommonMark y GFM mediante AST (`unified`, `remark-parse`, `remark-gfm`).
- Front matter YAML sólo al inicio, con allowlist: `title`, `subtitle`,
  `language`, `template`, `author`, `theme` y `tags`.
- `#` como título editorial y `##` como sección. Las secciones aceptan
  `{#source-id type=SOLUTION included=true internal=false}`.
- Tipos cerrados, inferencia por título sin IA, `sourceId` estable y rechazo de
  duplicados.
- Variables reconocidas sin resolver aún. Las permitidas se limitan al catálogo
  del diseño; `\{{variable}}` se preserva literal.
- Directivas seguras: `janvier-callout`, `janvier-metrics`,
  `janvier-decision`, `janvier-ascii`, `janvier-page-break` y
  `janvier-internal`.
- Imágenes únicamente como `asset:alias` a nivel de sintaxis. El almacenamiento
  y la resolución de activos quedan fuera de este hito.

## Seguridad y diagnósticos

El parser usa `TextDecoder("utf-8", { fatal: true })`, límite de 1 MiB,
60 secciones, 10 000 nodos, profundidad 12, 50 referencias de activo y líneas
de 50 KiB. Transforma MDAST a una estructura JANVIER validada con Zod y ejecuta
sanitización HAST sin `rehype-raw` ni `dangerouslySetInnerHTML`.

Errores representativos: `EMPTY_MARKDOWN`, `INVALID_UTF8`, `BINARY_FILE`,
`RAW_HTML_NOT_ALLOWED`, `UNSAFE_LINK`, `INVALID_ASSET_REFERENCE`,
`FORBIDDEN_FRONT_MATTER_KEY`, `DUPLICATE_SECTION_ID`,
`INVALID_SECTION_TYPE`, `INVALID_CALLOUT`, `UNKNOWN_VARIABLE`,
`INVALID_STRUCTURAL_VARIABLE_POSITION`, `ASSET_LIMIT` y `NODE_LIMIT`.
Todos incluyen severidad, código, línea y columna.

`npm audit --omit=dev` informa tres vulnerabilidades altas preexistentes
asociadas a `next` y sus transitivas `postcss`/`sharp`. Ninguna corresponde a
las dependencias Markdown añadidas. Actualizar Next se mantiene fuera de este
hito para no mezclar una actualización de framework con la migración de datos.

## Pruebas ejecutadas

- Parser unitario: 9 pruebas; CommonMark/GFM, BOM, variables escapadas, XSS,
  enlaces, front matter, IDs, directivas, binarios, límites y fuente legacy.
- `npm run check`: 23 pruebas unitarias, tipos, lint y formato correctos.
- `npm run build`: correcto.
- `npm run test:e2e:production` con `PROJECT_ROOM_E2E=1`: 29 pasaron, 1
  condicional de catálogo se omitió; las pruebas reales de aceptación,
  invitaciones y snapshot de Project Room pasaron.
- `docker compose build web`: correcto.

El warning de deprecación de `pg` durante la carga E2E es el ya documentado en
[PG_ADAPTER_WARNING.md](./PG_ADAPTER_WARNING.md); no proviene del parser ni de
la migración.
