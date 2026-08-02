# Proposal Studio — Markdown First

**Estado:** propuesta técnica previa a implementación.  
**Alcance:** \`PROPOSAL_STUDIO_MARKDOWN_FIRST\`.  
**Sustituye para implementación:** [el plan editorial anterior](./PROPOSAL_STUDIO_PR_PLAN.md).

## Decisión

La fuente editorial principal de una propuesta será un archivo Markdown
versionado. La plataforma no será un WYSIWYG ni una colección de campos de
texto para redactar cada bloque.

Los datos administrativos, comerciales, económicos, de permisos y aceptación
seguirán siendo estructurados y autoritativos en PostgreSQL. El Markdown puede
**mostrar** esos datos mediante variables o marcadores, pero no puede definir
cliente, importes, estado, permisos, invitaciones o aceptación.

\`\`\`text
Markdown original ──parse/validate──> documento JANVIER seguro ─┐
Datos estructurados ──DTO permitido────────────────────────────┼─> preview / Project Room
└─> snapshot / PDF futuro
\`\`\`

PDF queda preparado por esta arquitectura, pero no bloquea el sprint ni se
implementará en sus hitos.

## Auditoría del estado actual

| Área                | Estado comprobado                                                                                                                                        | Consecuencia para Markdown First                                                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Propuesta           | \`Proposal\` guarda cliente, referencia, moneda, vigencia, estado y alternativa seleccionada.                                                            | Se reutiliza: no se crea una propuesta paralela.                                                                                                        |
| Revisión            | \`ProposalRevision\` ya versiona título, introducción, términos, inversión, bloqueo y sustitución.                                                       | El Markdown pertenece a una revisión, no a \`Proposal\` global.                                                                                         |
| Secciones           | \`ProposalSection\` tiene \`id\`, tipo, posición, título, contenido, \`metadata\` e \`isIncluded\`.                                                      | Es el destino de cada \`##\`, pero carece de identificador de fuente, AST, rango de líneas e indicador interno.                                         |
| Editor actual       | \`ProposalRevisionEditor\` edita secciones, opciones y conceptos en el mismo formulario.                                                                 | Se divide en Documento y datos estructurados; no se añade otro sistema de edición.                                                                      |
| Guardado actual     | \`updateEditableProposalRevision\` elimina y vuelve a crear secciones, alternativas y conceptos.                                                         | No puede continuar para secciones Markdown: destruiría IDs estables y futuros comentarios. Se sustituye por sincronización por identificador de fuente. |
| Nueva revisión      | \`createEditableProposalRevision\` clona secciones, opciones y conceptos de una revisión bloqueada.                                                      | También tendrá que clonar fuente Markdown, checkpoints y referencias inmutables de activos.                                                             |
| Project Room        | Lee la revisión de la invitación y selecciona explícitamente los campos públicos de conceptos.                                                           | Se conserva; evoluciona a un DTO público único y renderer JANVIER compartido.                                                                           |
| Inmutabilidad       | La máquina de estados central bloquea al compartir y \`ProposalAcceptance\` usa snapshot SHA-256.                                                        | No se modifica. Markdown y activos obedecerán el mismo bloqueo.                                                                                         |
| Seguridad existente | Las mutaciones administrativas pasan por \`requireCurrentAdmin\`; no existe parser Markdown, almacenamiento privado de activos ni rate limit específico. | Los hitos añaden esos controles sin confiar en el cliente.                                                                                              |

### Compatibilidades e incompatibilidades resueltas

1. **IDs estables:** borrar y recrear secciones es incompatible. Las secciones
   importadas se actualizan por \`sourceId\`; una sección eliminada se conserva
   marcada como removida en el borrador en lugar de perder su identidad.
2. **DRAFT incompleto:** una propuesta puede guardar un borrador sin portada,
   alcance o condiciones. Una sección faltante bloquea publicación
   (\`INCOMPLETE\`), no la persistencia del borrador.
3. **Markdown original e interno:** el original, incluso con
   \`janvier-internal\`, se preserva como evidencia privada. Project Room, PDF
   de cliente y DTO público eliminan esos nodos en servidor; nunca con CSS.
4. **Snapshots previos:** las aceptaciones existentes no se recalculan. Se
   tratan como \`project-room-v1\`; las nuevas usan \`markdown-first-v1\`.
5. **Condiciones:** el dialecto usa \`CONDITIONS\`. En V1 se mapea al enum
   persistente existente \`TERMS\` para evitar una conversión destructiva de
   datos históricos.

## Modelo de datos propuesto

No se crea \`MarkdownProposal\`, \`ProposalDocumentV2\`, \`NewProposalContent\`
ni otra propuesta duplicada. Sólo se añaden fuente y activos a la revisión
existente.

### Fuente y checkpoints

\`\`\`prisma
enum ProposalMarkdownParseStatus {
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
}

model ProposalMarkdownSource {
id String @id @default(cuid())
revisionId String @unique
originalFileName String? @db.VarChar(255)
sourceMarkdown String @db.Text
sourceHash String @db.Char(64)
encoding String @default("UTF-8") @db.VarChar(16)
parserVersion String @db.VarChar(32)
version Int @default(1)
parseStatus ProposalMarkdownParseStatus
parseWarnings Json?
normalizedAst Json?
importedAt DateTime @default(now())
importedByAdminId String
lastParsedAt DateTime @default(now())
createdAt DateTime @default(now())
updatedAt DateTime @updatedAt

revision ProposalRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
importedBy AdminUser @relation("MarkdownSourceImporter", fields: [importedByAdminId], references: [id], onDelete: Restrict)
checkpoints ProposalMarkdownCheckpoint[]
}

model ProposalMarkdownCheckpoint {
id String @id @default(cuid())
sourceId String
sequence Int
reason ProposalMarkdownCheckpointReason
sourceMarkdown String @db.Text
sourceHash String @db.Char(64)
parserVersion String @db.VarChar(32)
parseStatus ProposalMarkdownParseStatus
parseWarnings Json?
originalFileName String? @db.VarChar(255)
createdByAdminId String
createdAt DateTime @default(now())

source ProposalMarkdownSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
createdBy AdminUser @relation("MarkdownCheckpointCreator", fields: [createdByAdminId], references: [id], onDelete: Restrict)

@@unique([sourceId, sequence])
@@index([sourceId, createdAt])
}
\`\`\`

\`sourceMarkdown\` conserva el texto decodificado en UTF-8, exactamente salvo
la eliminación documentada de un BOM inicial. No se guardan rutas locales ni
codificaciones alternativas. \`sourceHash\` es SHA-256 del texto UTF-8 sin BOM:
no se normalizan silenciosamente espacios ni saltos de línea.

\`normalizedAst\` es una caché de AST segura y validada, nunca HTML. Toda
lectura la valida de nuevo contra su schema antes de renderizar. El parser se
ejecuta autoritativamente al importar, confirmar, publicar, compartir y crear
un snapshot; la caché sólo evita trabajo de preview.

Una reimportación primero se analiza como candidata. Sólo al confirmar se crea
el checkpoint anterior, se actualiza la fuente y se guarda el checkpoint nuevo
en la misma transacción. Una entrada con errores críticos no persiste; el
editor conserva el texto local para corregirlo.

### Secciones derivadas de Markdown

\`ProposalSection\` se amplía, no se reemplaza:

| Campo                                   | Regla                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| \`sourceId\`                            | Identificador explícito de encabezado, por ejemplo \`solution\`; único por revisión y estable entre reimportaciones. |
| \`slug\`                                | Anchor seguro derivado de \`sourceId\`; único por revisión y no depende del texto visible.                           |
| \`contentAst\`                          | Árbol seguro de contenido de la sección, sin HTML crudo ni componentes ejecutables.                                  |
| \`internalOnly\`                        | Sólo para una sección marcada interna. Los nodos \`janvier-internal\` dentro de una sección viven en el AST.         |
| \`sourceStartLine\` / \`sourceEndLine\` | Líneas del Markdown para diagnóstico; opcionales para los datos históricos.                                          |
| \`removedAt\`                           | Conserva una sección desaparecida en \`MERGE_BY_SECTION_ID\`; siempre se excluye del renderer público.               |

El \`id\` CUID existente continúa siendo la clave relacional. \`sourceId\` es la
identidad editorial declarada en Markdown. Para secciones históricas se hará
backfill con \`legacy-<id>\` y se generará una fuente
\`legacy-generated.md\`; no se alteran snapshots ni estados.

La sincronización compara \`revisionId + sourceId\`:

- mismo ID: actualiza título, tipo, AST, líneas y posición;
- ID nuevo: crea sección;
- ID ausente en candidato: lo presenta como eliminado y, tras confirmar, marca
  \`removedAt\` e \`isIncluded: false\`;
- ID repetido: error crítico; no se adivina por el título.

### Activos privados

\`\`\`prisma
model ProposalAsset {
id String @id @default(cuid())
revisionId String
alias String @db.VarChar(80)
originalFileName String @db.VarChar(255)
storageKey String @unique @db.VarChar(512)
mimeType String @db.VarChar(128)
sizeBytes Int
sha256 String @db.Char(64)
width Int?
height Int?
altText String @db.VarChar(500)
isRequired Boolean @default(false)
uploadedByAdminId String
createdAt DateTime @default(now())
removedAt DateTime?

revision ProposalRevision @relation(fields: [revisionId], references: [id], onDelete: Cascade)
uploadedBy AdminUser @relation("ProposalAssetUploader", fields: [uploadedByAdminId], references: [id], onDelete: Restrict)

@@unique([revisionId, alias])
@@index([revisionId, removedAt])
}
\`\`\`

\`storageKey\` se resuelve sólo mediante un adaptador privado. En desarrollo
puede apuntar a un volumen Docker fuera de \`public/\`; producción requiere un
backend privado equivalente. Al crear una revisión se copian registros que
referencian el blob inmutable y hasheado; una revisión bloqueada no modifica un
activo existente.

Los formatos iniciales son PNG, JPEG y WebP. SVG sólo se habilita al pasar un
sanitizador estricto probado contra scripts, atributos de evento,
\`foreignObject\`, URLs externas y \`data:\`; mientras tanto se rechaza.

### Datos estructurados posteriores

Markdown no cambia la fuente de verdad de \`ProposalOption\`,
\`ProposalLineItem\`, cliente, referencia, moneda, vigencia ni aceptación.

El hito comercial ampliará \`ProposalLineItem\` con \`name\`, \`unit\`,
\`billingPeriod\`, \`isOptional\`, \`isIncluded\`, \`contingency\` y
\`supplier\`; los tipos añadirán \`HOURLY\`, \`PER_USER\`, \`PER_DEVICE\` y
\`PER_LOCATION\`. Subtotal, impuesto y total son derivados con
\`Prisma.Decimal\`, nunca columnas editables.

\`ProposalRevision\` recibirá \`language\` (por defecto \`es-MX\`) y preferencia
de tema de presentación. Son datos manuales; front matter puede sugerirlos,
pero nunca sobrescribirlos. El título comercial estructurado prevalece sobre
el \`#\` editorial; una discrepancia genera advertencia.

## Gramática Markdown JANVIER v1

Se admite CommonMark con GFM: encabezados, párrafos, énfasis, negritas, listas,
tareas, enlaces, citas, separadores, código inline, bloques de código, tablas
y notas al pie si el plugin estable las produce. Es Markdown, no MDX: no hay
imports, JSX, expresiones ni componentes React arbitrarios.

### Front matter opcional

\`\`\`md
---

title: Sistema de gestión comercial
subtitle: Operación preparada para escalar
language: es
template: software-project
author: Angel Janvier
theme: neutral
tags: [operación, software]
---

\`\`\`

Sólo se aceptan \`title\`, \`subtitle\`, \`language\`, \`template\`, \`author\`,
\`theme\` y \`tags\`. Valores son escalares o una lista corta de strings. El
parser YAML desactiva aliases y tags personalizados, y después se valida con
Zod. Claves como \`client\`, \`email\`, \`currency\`, \`price\`, \`tax\`,
\`status\`, \`invite\`, \`permission\`, \`acceptance\`, \`internalCost\` o
\`markup\` son **ERROR**. Una clave desconocida no sensible es **WARNING** y no
cambia datos.

### Encabezados y secciones

\`\`\`md

# Sistema de gestión comercial

## Resumen ejecutivo {#summary type=EXECUTIVE_SUMMARY}

Texto del resumen.

## Solución propuesta {#solution type=SOLUTION}

### Flujo de operación

\`\`\`

- debe haber un solo \`#\` editorial para compartir;
- cada \`##\` abre una sección principal;
- \`###\` y niveles inferiores permanecen en esa sección;
- los atributos terminales sólo admiten \`#sourceId\`, \`type=TYPE\`,
  \`included=true|false\` e \`internal=true|false\`;
- \`sourceId\` coincide con \`[a-z][a-z0-9-]{0,63}\`;
- sin ID se genera slug normalizado del título y se advierte de posible ruptura
  si el título cambia;
- sin tipo se usa catálogo cerrado de títulos y, si no coincide, \`CUSTOM\`.
  No se usa IA.

Tipos de dialecto: \`COVER\`, \`EXECUTIVE_SUMMARY\`, \`CONTEXT\`, \`PROBLEM\`,
\`OBJECTIVES\`, \`SOLUTION\`, \`SCOPE\`, \`DELIVERABLES\`, \`ARCHITECTURE\`,
\`ALTERNATIVES\`, \`TIMELINE\`, \`INVESTMENT\`, \`CONDITIONS\`, \`EXCLUSIONS\`,
\`NEXT_STEPS\`, \`FAQ\`, \`CALLOUT\`, \`METRICS\` y \`CUSTOM\`.

### Variables cerradas

\`\`\`md
Preparado para {{client.companyName}}.
Referencia: {{proposal.reference}}.
\`\`\`

Las variables permitidas son \`client.companyName\`, \`client.contactName\`,
\`client.email\`, \`proposal.reference\`, \`proposal.title\`,
\`proposal.validUntil\`, \`proposal.currency\`, \`author.name\` y
\`currentDate\`. \`\\{{client.companyName}}\` se conserva literal. El renderer
usa un diccionario fijo, no evalúa expresiones ni lee propiedades dinámicas.

\`{{proposal.options}}\` y \`{{proposal.timeline}}\` son marcadores
estructurales: sólo ocupan un párrafo. El renderer inserta alternativas o
cronograma desde datos estructurados; totales escritos a mano no son
autoritativos.

### Directivas permitidas

Una directiva comienza en columna 1 y termina con \`:::\`. Su cabecera admite
líneas \`clave: valor\` hasta la primera línea vacía; el resto se analiza como
Markdown normal. No hay anidamiento en V1.

\`\`\`md
:::janvier-callout
type: info
title: Nota técnica

El acceso se define antes de iniciar la implementación.
:::

:::janvier-metrics

- label: Usuarios
  value: 600+
- label: Ubicaciones
  value: 4
  :::

:::janvier-decision
title: Decisión recomendada

Iniciar con la alternativa Operation.
:::

:::janvier-ascii
STATUS: READY
SYSTEM: JANVIER
:::

:::janvier-page-break
:::

:::janvier-internal
Recordatorio privado para revisión comercial.
:::
\`\`\`

| Directiva              | Schema cerrado y comportamiento                                                         |
| ---------------------- | --------------------------------------------------------------------------------------- |
| \`janvier-callout\`    | \`type\` ∈ \`info\`, \`warning\`, \`signal\`; título opcional y cuerpo Markdown seguro. |
| \`janvier-metrics\`    | Lista de hasta 12 pares \`label\` / \`value\`, ambos texto plano limitado.              |
| \`janvier-decision\`   | Título obligatorio y cuerpo Markdown seguro.                                            |
| \`janvier-ascii\`      | Texto monoespaciado limitado a caracteres imprimibles; nunca interpreta markup.         |
| \`janvier-page-break\` | Sin atributos ni cuerpo; no altera pantalla y se reserva para PDF futuro.               |
| \`janvier-internal\`   | Visible sólo en administración; se elimina del DTO público antes de React.              |

HTML crudo, \`<script>\`, \`<iframe>\`, event handlers, estilos inline,
formularios, embeds, URLs \`javascript:\`, \`data:\`, \`file:\` o
\`vbscript:\`, SVG crudo, MDX, imports y expresiones son errores críticos. Los
bloques de código se presentan con estilo JANVIER, jamás se ejecutan.

### Imágenes y enlaces

\`\`\`md
![Diagrama de arquitectura](asset:architecture-diagram)
\`\`\`

Sólo \`asset:alias\` resuelve imágenes. Rutas locales, URL remota, \`file:\` y
rutas del sistema son inválidas. Un activo faltante advierte en preview y
bloquea publicación si está marcado como requerido; no derriba el documento.

Enlaces permitidos: \`https\`, \`mailto\`, \`tel\` e internos seguros. \`http\`
sólo advierte en desarrollo y bloquea publicación en producción. Enlaces
externos reciben \`rel="noopener noreferrer"\` desde el renderer controlado.

## Pipeline de análisis, sanitización y render

Se añadirán sólo en el hito de parser dependencias pequeñas y mantenidas:
\`unified\`, \`remark-parse\`, \`remark-gfm\`, \`remark-frontmatter\`,
\`remark-directive\`, \`remark-rehype\`, \`rehype-sanitize\` y un parser YAML
configurado con seguridad. No habrá editor WYSIWYG pesado.

\`\`\`text
bytes de archivo
→ validar extensión, límite, UTF-8 y ausencia de binario
→ MDAST (remark, sin MDX ni raw HTML)
→ validar front matter / encabezados / directivas / variables
→ JanvierDocumentAst (Zod, IDs y rangos de origen)
→ HAST semántico + schema allowlist
→ registry de componentes React controlados
\`\`\`

No se habilita \`rehype-raw\` ni se usa \`dangerouslySetInnerHTML\`. El registry
sólo conoce nodos de texto, encabezado, lista, tabla, cita, código, enlace,
imagen de activo, divisor y las seis directivas JANVIER. \`rehype-sanitize\`
es una segunda barrera: URL, directivas y variables se validan antes.

El parser retorna
\`{ severity, code, message, line, column, sectionSourceId?, suggestion? }\`.
Límites iniciales configurables: 1 MiB, 60 secciones, 10 000 nodos,
profundidad 12, 50 activos y línea máxima de 50 KiB. Usa
\`TextDecoder("utf-8", { fatal: true })\`, comprobación de bytes nulos/control y
hash antes de parsear. El cliente puede previsualizar con debounce en worker;
el servidor repite la validación antes de persistir, compartir o aceptar.

## Importación, edición y concurrencia

En \`/admin/propuestas/[proposalId]\`, la pestaña **Documento** contiene
\`MARKDOWN_SOURCE\`: arrastrar \`.md\`/ \`.markdown\`, selector, pegado,
descarga de fuente, plantilla y textarea monoespaciado mejorado. No procesa
rutas locales ni archivos remotos.

\`\`\`text
ARCHIVO → VALIDACIÓN → PARSEO → DIAGNÓSTICO → PREVIEW → CONFIRMACIÓN
→ PERSISTENCIA TRANSACCIONAL → RENDER JANVIER
\`\`\`

Antes de confirmar se muestran archivo, tamaño, hash, secciones, títulos,
variables, enlaces, activos, advertencias, errores y diff contra fuente activa.

- \`REPLACE\`: la candidata se convierte en documento completo.
- \`MERGE_BY_SECTION_ID\` (predeterminado): la candidata es completa, pero su
  sincronización conserva filas con mismo \`sourceId\` y marca las ausentes.
- \`APPEND\`: compone fuente activa, separador semántico e input nuevo; conserva
  el input original en checkpoint y revalida el resultado.

Cada modificación exige \`expectedSourceHash\` y \`version\`. Una actualización
condicional dentro de transacción evita que dos pestañas se pisen. Ante
conflicto el servidor devuelve diff y no escribe. El editor autosalva con
debounce sólo en \`DRAFT\`, soporta Ctrl/Cmd+S, búsqueda, líneas y diagnóstico;
una copia de recuperación en \`sessionStorage\` por revisión se limpia tras
confirmación exitosa.

No se puede reemplazar fuente, restaurar checkpoint, subir activo ni autosalvar
en revisión bloqueada. Para \`SENT\`, \`VIEWED\` o \`CHANGES_REQUESTED\` se crea
primero una revisión \`DRAFT\` mediante el dominio actual.

## DTO público, publicación y snapshot

\`lib/proposals/public-dto.ts\` será la frontera obligatoria. Sus consultas usan
\`select\` explícito y producen:

\`\`\`ts
type PublicProposalRevisionDTO = {
proposal: { reference: string; currency: string; validUntil: string | null };
revision: { id: string; number: number; title: string; language: string };
document: JanvierPublicDocumentAst;
sections: PublicProposalSectionDTO[];
alternatives: PublicProposalAlternativeDTO[];
lineItems: PublicProposalLineItemDTO[];
timeline: PublicProposalTimelineDTO[];
totals: { subtotal: string; tax: string; total: string };
terms: string | null;
};
\`\`\`

No incluye \`sourceMarkdown\`, AST interno, \`internalOnly\`, \`internalCost\`,
\`markupPercent\`, contingencia, proveedor, notas internas, utilidad, tokens,
hashes de invitación, IP, user agent, autores administrativos ni metadata no
permitida. \`janvier-internal\` desaparece al construir
\`JanvierPublicDocumentAst\`, antes de React y antes de PDF.

El validador de publicación es derivado, no otro estado de \`Proposal\`:

- \`INCOMPLETE\`: faltan datos o secciones; puede guardarse, no compartirse.
- \`READY_WITH_WARNINGS\`: sin errores críticos, con advertencias revisables.
- \`READY_TO_SHARE\`: estructura y datos comerciales válidos.

Compartir continúa con \`assertProposalCanShare\` y \`transitionProposal\`. En
la misma transacción se bloquea la revisión y se registra un checkpoint
\`PRE_SHARE\`; el parser no escribe estados directamente.

Al aceptar, el servidor genera \`markdown-first-v1\` en
\`ProposalAcceptance.snapshot\`: fuente original privada, \`sourceHash\`,
versión de parser, AST normalizado, documento público resuelto, variables,
secciones, alternativa elegida, conceptos públicos, cálculos Decimal,
cronograma, condiciones y manifiesto de activos con hashes. \`contentHash\`
es SHA-256 del JSON canónico completo de evidencia.

La evidencia privada no se serializa a Project Room, PDF ni constancia de
cliente. Esta separación conserva el Markdown original y garantiza que
\`janvier-internal\` no llegue al cliente. Las aceptaciones V1 conservan su
snapshot y hash sin reescritura.

## Estrategia de migración

| Hito | Migración                                                                   | Despliegue seguro                                                                                                                         |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| A    | Tablas de fuente/checkpoints; campos de fuente en sección; enums aditivos.  | Crear campos opcionales, generar fuentes históricas y luego exigir \`sourceId\` sólo en secciones nuevas. Sin tocar estados ni snapshots. |
| D    | \`ProposalAsset\` y relaciones con usuario/revisión.                        | Configurar storage privado y volumen/credenciales antes de habilitar upload.                                                              |
| E    | Campos de concepto, periodicidad, tipos aditivos, idioma/tema y cronograma. | Añadir nullable/default; cálculos aceptan la forma anterior durante backfill.                                                             |
| H    | Versión explícita de snapshot si hace falta distinguir V1/V2.               | Se añade; no se reescriben aceptaciones ni hashes históricos.                                                                             |

Antes de cada migración: backup, \`prisma migrate deploy\`, \`prisma generate\`,
lectura de datos previos y build de producción. Las migraciones de enum son
aditivas; rollback desactiva UI/código, no borra enums de PostgreSQL.

## Plan exacto por commits

| Hito | Commit propuesto                                              | Entrega y límite                                                                                              |
| ---- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 0    | \`docs(proposals): define markdown-first architecture\`       | Este documento, sin código de producto.                                                                       |
| A    | \`feat(proposals): add markdown source domain and parser\`    | Schema, migración, parser seguro, schemas Zod, diagnósticos unitarios y fuente legacy. Sin UI de carga.       |
| B    | \`feat(proposals): import and persist markdown drafts\`       | Upload/pegado, preview candidato, confirmación transaccional, textarea, autosave y concurrencia. Sin activos. |
| C    | \`feat(proposals): render structured janvier markdown\`       | IDs/secciones, front matter, directivas, variables, renderer compartido y pruebas XSS. Sin conceptos nuevos.  |
| D    | \`feat(proposals): add private proposal assets\`              | Storage adapter, upload validado, \`asset:\` y manifiesto; SVG sólo si pasa sanitizer.                        |
| E    | \`feat(proposals): complete commercial proposal data\`        | Formularios, conceptos, alternativas, cronograma y cálculo Decimal.                                           |
| F    | \`feat(proposals): add proposal studio preview\`              | Preview administrativa, \`ADMIN_PREVIEW\`, neutral/night y lectura por DTO.                                   |
| G    | \`feat(proposals): add markdown reimport history\`            | Diff, replace/merge/append, checkpoints, restauración y plantillas.                                           |
| H    | \`feat(proposals): validate and snapshot markdown proposals\` | Gate de compartir, snapshot Markdown, integración Project Room y auditoría.                                   |
| I    | \`test(proposals): harden markdown studio release\`           | E2E producción, seguridad, accesibilidad, responsive, capturas y documentación.                               |

Cada hito termina con \`npm run check\`, \`npm run build\`, migración sobre base
de prueba y E2E relevante. No se inicia CRM, pagos, facturación, DOCX, firma
electrónica avanzada, automatización bancaria ni PDF.

## Criterios de aceptación

1. Angel puede crear un DRAFT, cargar o pegar Markdown UTF-8 y recibe
   diagnósticos con línea y columna antes de confirmar.
2. Un documento válido se vuelve una propuesta JANVIER responsive en neutral y
   night; puede corregirse, reimportarse, compararse y restaurarse en DRAFT.
3. IDs explícitos sobreviven cambios de título y reimportación; duplicados no
   se aceptan.
4. Directivas, variables, front matter, enlaces y \`asset:\` usan esquemas
   cerrados. HTML/MDX/URLs peligrosas nunca se ejecutan ni llegan al DOM.
5. Cliente, moneda, vigencia, impuestos, alternativas, conceptos, cronograma y
   aceptación siguen siendo datos estructurados; los totales usan Decimal.
6. \`janvier-internal\` y todos los costos internos no aparecen en Project
   Room, HTML público, DTO, PDF futuro ni constancia del cliente.
7. Compartir y aceptar usan la máquina de estados endurecida; una revisión
   bloqueada no cambia fuente, secciones ni activos.
8. Una aceptación nueva conserva fuente, hashes, parser, documento resuelto,
   activos, alternativa y cálculos inmutables; la evidencia V1 no se altera.
9. Unit tests cubren parser, XSS, variables, directivas, importación, diff,
   snapshots y exclusión de campos internos. E2E cubre carga, preview,
   reimportación, Project Room, aceptación, teclado, móvil y cero overflow.
