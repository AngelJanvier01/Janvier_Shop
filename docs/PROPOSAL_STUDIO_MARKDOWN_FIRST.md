# Proposal Studio — Markdown First

**Estado:** diseño aprobado para Hito A tras resolver invariantes de activos,
hashes, congelación y retención.

## Decisión y límite

Markdown es la fuente editorial versionada de cada `ProposalRevision`. PostgreSQL
es la fuente de verdad de clientes, comerciales, estados, permisos, aceptación
y cálculos. El renderer transforma solamente una representación segura,
estructurada y autorizada.

```text
Markdown original ── parser seguro ──> documento JANVIER
datos estructurados ── DTO permitido ──> documento JANVIER
                                      ├─ preview de DRAFT
                                      ├─ Project Room congelado
                                      └─ evidencia de aceptación
```

Este macro sprint no inicia CRM, pagos, facturación, DOCX, firma electrónica
avanzada, seguimiento operativo, automatización bancaria ni PDF. PDF sólo queda
preparado por el DTO y los hashes.

## Auditoría de la base actual

| Área                | Estado comprobado                                                                                                                                         | Implicación                                                                                          |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Dominio             | `Proposal` ya contiene cliente, referencia, moneda, vigencia, estado y alternativa seleccionada.                                                          | Se reutiliza; no existirá otra entidad de propuesta.                                                 |
| Revisión            | `ProposalRevision` versiona título, introducción, términos, inversión, `lockedAt`, `sharedAt` y `replacedAt`.                                             | La fuente Markdown pertenece a una revisión.                                                         |
| Secciones           | `ProposalSection` ya tiene CUID, tipo, posición, título, contenido, metadata e inclusión.                                                                 | Cada `##` se sincroniza aquí, pero se añaden identidad de fuente, AST y rango de líneas.             |
| Editor              | `ProposalRevisionEditor` reúne secciones, opciones y conceptos.                                                                                           | Se separará en Documento, Datos y Comercial, no se duplica un editor de propuestas.                  |
| Guardado            | `updateEditableProposalRevision` elimina y recrea secciones, opciones y conceptos.                                                                        | Es incompatible con IDs editoriales estables; el flujo Markdown sincroniza secciones por `sourceId`. |
| Nueva revisión      | `createEditableProposalRevision` clona las entidades comerciales.                                                                                         | También copiará una fuente actual y referencias de activos, no historiales completos ni bytes.       |
| Project Room        | Lee una revisión por invitación y ya selecciona campos públicos de conceptos.                                                                             | Mantiene su flujo endurecido y evoluciona a un DTO público único.                                    |
| Inmutabilidad       | La máquina `proposal-state` bloquea al compartir y `ProposalAcceptance` crea evidencia SHA-256.                                                           | No se cambia. Markdown, variables y activos siguen el mismo bloqueo.                                 |
| Seguridad existente | Las mutaciones admin exigen `requireCurrentAdmin`; aún no existe parser, storage privado, rate limit de importación ni control de concurrencia de fuente. | Hito A agrega sólo dominio/parser; los demás controles llegan en sus hitos.                          |

## Invariantes aprobadas

1. Una referencia de activo es distinta del blob físico.
2. Un hash público describe exactamente lo aceptado por el cliente; otro hash
   describe el expediente privado completo.
3. Una revisión compartida no resuelve variables de nuevo.
4. Clonar una revisión no clona checkpoints históricos.
5. Una revisión bloqueada no cambia fuente, variables congeladas, secciones ni
   referencias de activos.
6. `janvier-internal` se conserva en evidencia privada pero nunca se serializa
   al DTO público, Project Room, PDF de cliente ni constancia.

## Modelo de datos

No se crearán `MarkdownProposal`, `ProposalDocumentV2`, `NewProposalContent` ni
otra propuesta paralela.

### Fuente y checkpoints

```prisma
enum ProposalMarkdownParseStatus {
  PENDING_VALIDATION
  VALID
  WARNINGS
  ERROR
}

enum ProposalMarkdownCheckpointReason {
  IMPORT
  REIMPORT_REPLACE
  REIMPORT_MERGE
  APPEND
  MANUAL_SAVE
  TEMPLATE_APPLIED
  RESTORE
  PRE_SHARE
  REVISION_CLONED
}

model ProposalMarkdownSource {
  id                String                     @id @default(cuid())
  revisionId        String                     @unique
  sourceRevisionId  String?
  originalFileName  String?                    @db.VarChar(255)
  sourceMarkdown    String                     @db.Text
  sourceHash        String                     @db.Char(64)
  encoding          String                     @default("UTF-8") @db.VarChar(16)
  parserVersion     String                     @db.VarChar(32)
  version           Int                        @default(1)
  parseStatus       ProposalMarkdownParseStatus
  parseWarnings     Json?
  normalizedAst     Json?
  importedAt        DateTime                   @default(now())
  importedByAdminId String
  lastParsedAt      DateTime                   @default(now())
  createdAt         DateTime                   @default(now())
  updatedAt         DateTime                   @updatedAt

  revision          ProposalRevision           @relation("MarkdownSourceCurrent", fields: [revisionId], references: [id], onDelete: Cascade)
  sourceRevision    ProposalRevision?          @relation("MarkdownSourceOrigin", fields: [sourceRevisionId], references: [id], onDelete: SetNull)
  importedBy        AdminUser                  @relation("MarkdownSourceImporter", fields: [importedByAdminId], references: [id], onDelete: Restrict)
  checkpoints       ProposalMarkdownCheckpoint[]
}

model ProposalMarkdownCheckpoint {
  id                String                           @id @default(cuid())
  sourceId          String
  sequence          Int
  reason            ProposalMarkdownCheckpointReason
  sourceMarkdown    String                           @db.Text
  sourceHash        String                           @db.Char(64)
  parserVersion     String                           @db.VarChar(32)
  parseStatus       ProposalMarkdownParseStatus
  parseWarnings     Json?
  originalFileName  String?                          @db.VarChar(255)
  createdByAdminId  String
  createdAt         DateTime                         @default(now())

  source            ProposalMarkdownSource          @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  createdBy         AdminUser                       @relation("MarkdownCheckpointCreator", fields: [createdByAdminId], references: [id], onDelete: Restrict)
  acceptances       ProposalAcceptance[]            @relation("AcceptanceSourceCheckpoint")

  @@unique([sourceId, sequence])
  @@index([sourceId, createdAt])
}
```

`sourceMarkdown` conserva el texto decodificado UTF-8, exactamente salvo el BOM
inicial permitido y retirado. No se normalizan silenciosamente espacios ni
saltos de línea. `sourceHash` es `SHA-256(UTF-8(sourceMarkdown sin BOM))`.
`normalizedAst` es una caché de AST seguro, no HTML; se revalida antes de
renderizar y no sustituye al Markdown original.

`PENDING_VALIDATION` is a transient legacy-backfill state. SQL can create
`legacy-generated.md`, but it cannot run the JANVIER CommonMark parser, so the
AST remains `NULL` and the source is never declared `VALID` by migration SQL.
After `prisma migrate deploy`, deployment runs
`npm run proposals:backfill-markdown`; only then does a source receive its real
`VALID`, `WARNINGS`, or `ERROR` status, AST, and diagnostics.

Una fuente es única por revisión. Cada confirmación guarda el checkpoint que
corresponde a la fuente resultante; el anterior se conserva según la política
de retención. Entrada con error crítico no se persiste.

### Secciones derivadas

`ProposalSection` gana los siguientes campos aditivos:

| Campo                               | Uso                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `sourceId`                          | Identificador editorial de `{#solution}`; único por revisión y estable entre reimportaciones.       |
| `slug`                              | Anchor seguro derivado de `sourceId`; no depende del título.                                        |
| `contentAst`                        | Árbol seguro del contenido de la sección.                                                           |
| `internalOnly`                      | Señala sección completa interna; nodos internos parciales viven en el AST.                          |
| `sourceStartLine` / `sourceEndLine` | Ubican diagnósticos; son nulos para datos históricos si aplica.                                     |
| `removedAt`                         | Conserva identidad de una sección ausente en `MERGE_BY_SECTION_ID` y la excluye del render público. |

El CUID actual sigue siendo clave relacional. `sourceId` es la identidad del
autor. La sincronización usa `revisionId + sourceId`: actualiza coincidencias,
crea IDs nuevos y marca ausencias como removidas. ID repetido es error crítico;
nunca se asocia una sección sólo por título.

El backfill genera `legacy-<section.id>` para secciones existentes y una fuente
`legacy-generated.md` por revisión. No reescribe estados, invitaciones,
aceptaciones ni hashes históricos.

### Blobs y referencias de activos

```prisma
model ProposalAssetBlob {
  id          String   @id @default(cuid())
  storageKey  String   @unique @db.VarChar(512)
  sha256      String   @unique @db.Char(64)
  mimeType    String   @db.VarChar(128)
  sizeBytes   Int
  width       Int?
  height      Int?
  createdAt   DateTime @default(now())

  references  ProposalAsset[]
}

model ProposalAsset {
  id                String    @id @default(cuid())
  revisionId        String
  blobId            String
  alias             String    @db.VarChar(80)
  originalFileName  String    @db.VarChar(255)
  altText           String    @db.VarChar(500)
  isRequired        Boolean   @default(false)
  uploadedByAdminId String
  createdAt         DateTime  @default(now())
  removedAt         DateTime?

  revision   ProposalRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
  blob       ProposalAssetBlob @relation(fields: [blobId], references: [id], onDelete: Restrict)
  uploadedBy AdminUser @relation("ProposalAssetUploader", fields: [uploadedByAdminId], references: [id], onDelete: Restrict)

  @@unique([revisionId, alias])
  @@index([blobId])
  @@index([revisionId, removedAt])
}
```

Un blob físico se identifica por `sha256`. Si se carga el mismo contenido, se
reutiliza su blob; cada revisión conserva alias, alt, requisito y auditoría
propios. Clonar una revisión crea referencias nuevas al mismo `blobId`, no
copia bytes. Quitar una referencia nunca borra el blob por sí solo.

Los blobs huérfanos se limpian sólo mediante una tarea administrativa explícita
que comprueba ausencia de referencias, registra el evento y borra el objeto
privado después de la fila. Ningún blob ni archivo vive en `public/`.

El primer soporte de activos acepta PNG, JPEG y WebP. SVG se rechaza hasta que
un sanitizador estricto cubra scripts, handlers, `foreignObject`, URLs remotas
y `data:`.

### Variables congeladas y hashes

Al compartir se añadirá a `ProposalRevision` una representación pública
congelada y sus insumos:

```text
resolvedVariables       Json?     valores públicos resueltos
frozenPublicDocument    Json?     AST/render model público ya resuelto
publicContentHash       String?   SHA-256 canónico de lo visible
frozenAt                DateTime?
frozenParserVersion     String?
```

`ProposalAcceptance` conservará `contentHash` para compatibilidad V1 y añadirá:

```text
snapshotVersion         String     project-room-v1 | markdown-first-v1
publicContentHash       String?    referencia comercial
evidenceHash            String?    integridad del expediente privado
sourceCheckpointId      String?    relación protegida a checkpoint PRE_SHARE
```

Para `markdown-first-v1`, `contentHash` queda como alias de compatibilidad de
`publicContentHash`; el código nuevo nunca usa ese alias para verificar la
evidencia privada.

| Hash                | Incluye                                                                                                                                                                                                                           | No incluye                                                                                                                     |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `publicContentHash` | Documento público resuelto, variables congeladas, secciones públicas, hashes de activos visibles, alternativa seleccionada, conceptos visibles, subtotal, impuestos, total, moneda, cronograma, condiciones, revisión y vigencia. | Markdown original, `janvier-internal`, costos internos, proveedores, notas internas, tokens, IP y metadatos de administración. |
| `evidenceHash`      | Markdown original, `sourceHash`, versión de parser, AST normalizado, contenido público, contenido interno, manifiesto completo, información técnica de generación y `publicContentHash`.                                          | Nada del expediente interno definido para esa versión.                                                                         |

Ambos son `SHA-256(canonicalJson(...))`. Cambiar una nota interna modifica sólo
`evidenceHash`. Cambiar cualquier contenido visible modifica ambos. La
aceptación comercial y cualquier constancia de cliente referencian
`publicContentHash`; `evidenceHash` queda para verificación administrativa.

### Checkpoints, clonado y retención

Al crear una nueva revisión:

1. se copia la fuente Markdown actual como nueva `ProposalMarkdownSource`;
2. `sourceRevisionId` apunta a la revisión de origen;
3. se copian referencias de activos, nunca blobs ni bytes;
4. se crea un único checkpoint inicial `REVISION_CLONED`;
5. no se clona el historial de checkpoints de la revisión anterior.

La política inicial conserva siempre: `IMPORT`, `PRE_SHARE`, `RESTORE`, el
último `MANUAL_SAVE` y el `REVISION_CLONED` inicial. Conserva como máximo los
20 checkpoints automáticos más recientes por fuente.

La tarea explícita de retención no corre durante una solicitud normal. Antes de
eliminar verifica que el checkpoint no esté referenciado por aceptación, no sea
de una revisión bloqueada y no sea una clase conservada. Registra conteo, IDs,
actor/ejecutor y motivo de la eliminación. Restaurar un checkpoint en DRAFT
crea un nuevo checkpoint `RESTORE`; no cambia historia bloqueada.

### Datos comerciales posteriores

Markdown no es fuente de verdad de `Client`, `ProposalOption`,
`ProposalLineItem`, moneda, vigencia, estado ni aceptación.

El hito comercial ampliará conceptos con `name`, `unit`, `billingPeriod`,
`isOptional`, `isIncluded`, `contingency` y `supplier`, y añadirá tipos
`HOURLY`, `PER_USER`, `PER_DEVICE` y `PER_LOCATION`. Subtotal, impuestos y
total se calculan con `Prisma.Decimal` en servidor. `internalCost`,
`markupPercent`, contingencia, proveedor, notas y utilidad siguen siendo datos
estrictamente administrativos.

## Gramática JANVIER v1

Se admite CommonMark con GFM: encabezados, párrafos, énfasis, negritas, listas,
tareas, enlaces, citas, separadores, código inline, bloques de código y tablas.
No se admite MDX, JSX, imports, expresiones, HTML crudo ni componentes React.

### Front matter y secciones

```md
---
title: Sistema de gestión comercial
subtitle: Operación preparada para escalar
language: es
template: software-project
author: Angel Janvier
theme: neutral
tags: [operación, software]
---

# Sistema de gestión comercial

## Resumen ejecutivo {#summary type=EXECUTIVE_SUMMARY}

Texto.

## Solución propuesta {#solution type=SOLUTION}

### Flujo de operación
```

Front matter sólo permite `title`, `subtitle`, `language`, `template`, `author`,
`theme` y `tags`. YAML desactiva aliases y tags personalizados antes de Zod.
Claves como `client`, `currency`, `price`, `tax`, `status`, `invite`,
`permission`, `acceptance`, `internalCost` o `markup` son ERROR; claves
desconocidas no sensibles son WARNING y no cambian datos.

Hay un `#` editorial y cada `##` inicia una sección. Los atributos terminales
admiten sólo `#sourceId`, `type=TYPE`, `included=true|false` e
`internal=true|false`. `sourceId` cumple `[a-z][a-z0-9-]{0,63}`. Sin ID se
genera slug del título y se advierte de posible ruptura si éste cambia. Sin
tipo se usa un catálogo cerrado; si no coincide, `CUSTOM`. No se usa IA.

Tipos: `COVER`, `EXECUTIVE_SUMMARY`, `CONTEXT`, `PROBLEM`, `OBJECTIVES`,
`SOLUTION`, `SCOPE`, `DELIVERABLES`, `ARCHITECTURE`, `ALTERNATIVES`,
`TIMELINE`, `INVESTMENT`, `CONDITIONS`, `EXCLUSIONS`, `NEXT_STEPS`, `FAQ`,
`CALLOUT`, `METRICS` y `CUSTOM`. En V1 `CONDITIONS` persiste como el enum
histórico `TERMS`.

### Variables y directivas

Variables reconocidas, pero **no resueltas comercialmente en Hito A**:

```md
Preparado para {{client.companyName}}.
Referencia: {{proposal.reference}}.
{{proposal.options}}
{{proposal.timeline}}
```

El catálogo cerrado es `client.companyName`, `client.contactName`,
`client.email`, `proposal.reference`, `proposal.title`,
`proposal.validUntil`, `proposal.currency`, `author.name` y `currentDate`.
`\{{client.companyName}}` permanece literal. Un marcador de opciones o
cronograma ocupa un párrafo completo. El Hito A sólo reconoce, valida y
diagnostica las variables; la resolución y congelación llegan en Hito H.

```md
:::janvier-callout
type: info
title: Nota técnica

Contenido seguro.
:::

:::janvier-metrics

- label: Usuarios
  value: 600+
  :::

:::janvier-decision
title: Decisión recomendada

Contenido seguro.
:::

:::janvier-ascii
STATUS: READY
:::

:::janvier-page-break
:::

:::janvier-internal
Nota sólo administrativa.
:::
```

Se admiten exactamente seis directivas: `janvier-callout`,
`janvier-metrics`, `janvier-decision`, `janvier-ascii`,
`janvier-page-break` y `janvier-internal`. Cada una usa schema Zod cerrado,
produce diagnóstico de línea/columna y no acepta JSX, estilos ni atributos
arbitrarios. `janvier-internal` se conserva en AST privado.

Sólo se permiten enlaces `https`, `mailto`, `tel` e internos seguros.
`javascript:`, `data:`, `file:`, `vbscript:`, embeds, formularios, SVG crudo,
handlers y HTML son errores críticos. Los bloques de código sólo se muestran:
nunca se ejecutan.

## Parser, sanitización y diagnósticos

El pipeline de Hito A usa AST explícito:

```text
bytes → UTF-8 y límites → MDAST → validación JANVIER
      → JanvierDocumentAst Zod → HAST seguro → componentes controlados
```

Se añadirán `unified`, `remark-parse`, `remark-gfm`, `remark-frontmatter`,
`remark-directive`, `remark-rehype`, `rehype-sanitize` y parser YAML seguro.
No se habilita `rehype-raw` ni `dangerouslySetInnerHTML`. El renderer sólo
recibe texto, encabezados, listas, tablas, citas, código, enlaces, imágenes de
activo, divisor y las seis directivas.

El parser devuelve
`{ severity, code, message, line, column, sectionSourceId?, suggestion? }`.
Límites configurables iniciales: 1 MiB, 60 secciones, 10 000 nodos,
profundidad 12, 50 activos referenciados y líneas de 50 KiB. La entrada usa
`TextDecoder("utf-8", { fatal: true })` y rechaza bytes nulos, binarios,
extensiones distintas de `.md`/`.markdown` y archivos vacíos.

## Ciclo de variables y publicación

| Estado        | Fuente de variables y documento                                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DRAFT         | Preview puede resolver valores actuales; variables faltantes son advertencias y no existe evidencia congelada.                                                                                                                  |
| Compartir     | Una transacción valida Markdown, resuelve variables públicas, guarda `resolvedVariables` y `frozenPublicDocument`, calcula `publicContentHash`, crea `PRE_SHARE`, bloquea revisión, genera invitación y realiza `DRAFT → SENT`. |
| SENT / VIEWED | Project Room usa exclusivamente documento y variables congelados. `currentDate` no cambia y una modificación de Client/Proposal no altera la revisión.                                                                          |
| ACCEPTED      | La aceptación copia exactamente el documento compartido y añade la evidencia privada para `evidenceHash`.                                                                                                                       |
| Nueva DRAFT   | Al clonar, resuelve de nuevo variables actuales y puede producir valores nuevos.                                                                                                                                                |

`proposal-state` conserva autoridad de transiciones. El parser, renderer y
validador no escriben `status` directamente.

## DTO, snapshots y privacidad

`lib/proposals/public-dto.ts` será la única frontera Prisma → cliente:

```ts
type PublicProposalRevisionDTO = {
  proposal: { reference: string; currency: string; validUntil: string | null };
  revision: { id: string; number: number; title: string; language: string };
  document: JanvierPublicDocumentAst;
  alternatives: PublicProposalAlternativeDTO[];
  lineItems: PublicProposalLineItemDTO[];
  timeline: PublicProposalTimelineDTO[];
  totals: { subtotal: string; tax: string; total: string };
};
```

No contiene Markdown original, AST interno, `internalOnly`, costos, markup,
contingencia, proveedor, notas, utilidad, tokens, hashes de invitación, IP,
user agent, autores admin ni metadata no permitida.

El snapshot `markdown-first-v1` contiene dos paquetes explícitos:

- **publicSnapshot:** el contenido exacto protegido por `publicContentHash`;
- **privateEvidence:** Markdown original, AST, internos, manifiesto completo y
  metadatos técnicos protegidos por `evidenceHash`.

La parte privada sólo se entrega a administración autorizada. Las aceptaciones
`project-room-v1` existentes no se reescriben ni vuelven a hashear.

## Migraciones y backfill revisados

| Hito | Cambio                                                                                        | Seguridad de despliegue                                                                        |
| ---- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| A    | Fuente, checkpoints, relaciones AdminUser/Revision, campos aditivos de sección y enums.       | Campos primero compatibles; backfill `legacy-generated.md`; no toca assets, hashes ni estados. |
| D    | `ProposalAssetBlob` + `ProposalAsset` y storage privado.                                      | No se habilita upload sin adaptador privado configurado.                                       |
| E    | Conceptos, periodicidad, alternativas, cronograma, idioma y tema.                             | Campos nullable/default y cálculo compatible durante transición.                               |
| H    | Documento/variables congelados en revisión y hashes duales/snapshot versionado en aceptación. | Sólo nuevas aceptaciones usan V2; no se reescribe evidencia V1.                                |

Cada migración requiere backup, `prisma migrate deploy`, `prisma generate`,
lectura de datos anteriores, build de producción y rollback por desactivación
de UI/código, nunca por borrar valores de enum.

## Plan de commits

| Hito | Commit                                                      | Límite                                                                                                                                                                                        |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0.1  | `docs(proposals): resolve markdown architecture invariants` | Este ajuste documental.                                                                                                                                                                       |
| A    | `feat(proposals): add markdown source domain and parser`    | Modelos de fuente/checkpoint, sección aditiva, migración/backfill, parser, AST, diagnósticos, sanitización y pruebas. Sin upload, activos, renderer público, hashes de aceptación ni preview. |
| B    | `feat(proposals): import and persist markdown drafts`       | Upload/pegado, candidato, confirmación, editor y concurrencia.                                                                                                                                |
| C    | `feat(proposals): render structured janvier markdown`       | Renderer compartido, variables/directivas visuales y contenidos internos admin.                                                                                                               |
| D    | `feat(proposals): add private proposal assets`              | Blobs/referencias, storage y `asset:`.                                                                                                                                                        |
| E    | `feat(proposals): complete commercial proposal data`        | Formularios, conceptos, alternativas y cronograma.                                                                                                                                            |
| F    | `feat(proposals): add proposal studio preview`              | Preview admin y `ADMIN_PREVIEW`.                                                                                                                                                              |
| G    | `feat(proposals): add markdown reimport history`            | Diff, restore, plantillas y retención.                                                                                                                                                        |
| H    | `feat(proposals): validate and snapshot markdown proposals` | Congelación, hashes duales, publicación y Project Room.                                                                                                                                       |
| I    | `test(proposals): harden markdown studio release`           | E2E producción, seguridad, accesibilidad y responsive.                                                                                                                                        |

## Pruebas previstas

Hito A cubre parser CommonMark/GFM, BOM UTF-8, archivo vacío, límite, binario,
HTML/URL peligrosa, front matter seguro/prohibido, IDs duplicados, tipos
inferidos/declarados, directivas válidas/inválidas, variables reconocidas,
variables escapadas, línea/columna y `legacy-generated.md`.

Hitos D, G y H añaden pruebas de deduplicación de blobs, clon por referencia,
retención/restauración, variables congeladas y hashes duales:

- cambiar `Client.contactName` tras compartir no cambia documento público;
- abrir días distintos conserva `currentDate` congelada;
- aceptación usa el documento compartido exacto;
- nueva DRAFT puede resolver valores actualizados;
- modificar una nota interna cambia sólo `evidenceHash`;
- modificar contenido visible cambia `publicContentHash` y `evidenceHash`.

Cada hito termina con `npm run check`, `npm run build`, migración en base vacía
y con datos existentes, `prisma migrate deploy` dos veces y pruebas existentes
de Project Room. El cierre de Hito A incluye además build Docker y repositorio
sin cambios pendientes.
