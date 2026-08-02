# Proposal Studio — diseño previo a implementación

**Estado:** diseño aprobado como base de los PR 2–6.  
**Base:** `v2-project-room-hardened` y el commit de marca `93a20d5`.  
**Límite:** este documento no implementa los PR posteriores ni cambia la
máquina de estados endurecida de Project Room.

## Principios de diseño

- La propuesta web privada es la fuente oficial. PDF, constancia y resumen se
  generan de la misma representación pública y versionada.
- Una revisión compartida o aceptada no se modifica. Los cambios se hacen en
  una nueva revisión `DRAFT` a través del módulo central de estado.
- Los importes se calculan en servidor con `Prisma.Decimal`; el cliente sólo
  recibe valores ya autorizados y serializados como texto decimal.
- Información interna nunca se elimina mediante CSS: no se selecciona desde
  consultas públicas, no forma parte del DTO público, snapshot público, PDF o
  metadata de eventos visibles al cliente.
- El contenido editorial es texto estructurado y metadata validada. No se
  acepta HTML libre, scripts, estilos arbitrarios ni renderizado de Markdown
  HTML sin una política de sanitización explícita.

## Inventario reutilizable

La base actual ya evita empezar Proposal Studio desde cero:

| Pieza actual                                                                                                      | Uso en Proposal Studio                                                                                                                                      |
| ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Proposal`, `ProposalRevision`, `ProposalSection`, `ProposalOption` y `ProposalLineItem`                          | Núcleo versionado de propuesta, se amplía gradualmente sin crear una segunda fuente de verdad.                                                              |
| `components/admin/proposal-revision-editor.tsx`                                                                   | Se convierte en el compositor de bloques; se conserva su guardado atómico de la revisión, pero con identificadores persistentes y reordenamiento accesible. |
| `app/(admin)/admin/propuestas/actions.ts`                                                                         | Punto de validación de formularios y de auditoría; seguirá usando autorización administrativa y el dominio de propuesta.                                    |
| `lib/proposals/proposal-snapshot.ts`                                                                              | Origen de cálculos con `Decimal`, JSON canónico y `contentHash`; se evoluciona a partir de un DTO público único.                                            |
| `app/propuesta/[token]` y los componentes `ProposalOptionSelector`, `ProposalDecisionForm`, `ProposalCommentForm` | Render público privado, elección y decisión. Dejarán de hacer selecciones Prisma ad hoc para consumir un DTO permitido.                                     |
| `lib/proposals/proposal-state.ts`                                                                                 | Único camino para `DRAFT → SENT`, `VIEWED → CHANGES_REQUESTED`, `SENT/VIEWED → ACCEPTED` y demás transiciones. Ningún editor escribe `status` directamente. |
| `ProposalAcceptance.snapshot` y `contentHash`                                                                     | Evidencia inmutable para la constancia; no se recalcula desde datos editables una vez aceptada.                                                             |

## Modelo de datos propuesto

Los campos siguientes se añaden sólo en el PR que los necesita. Las entidades
existentes conservan su significado y sus relaciones de revisión.

### PR 2 — bloques editoriales estructurados

`ProposalSection` ya contiene `id`, `revisionId`, `type`, `position`, `title`,
`content`, `metadata` e `isIncluded`. Se conservará el `id` técnico y se añade
un identificador estable de bloque:

| Campo        | Tipo / regla                                                                      | Motivo                                                                                                |
| ------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `key`        | `String @db.VarChar(64)`, único por `revisionId`, inmutable dentro de la revisión | Referencia segura para orden, comentarios futuros, PDF y pruebas sin depender de la posición.         |
| `type`       | Enum ampliado                                                                     | Representa el bloque, no su presentación visual.                                                      |
| `metadata`   | `Json?`, validada por schema Zod discriminado por `type`                          | Guarda datos pequeños y declarativos (por ejemplo etiqueta o variante), nunca HTML ni datos internos. |
| `isIncluded` | existente                                                                         | Mantiene bloque incluido/excluido sin borrarlo; el DTO público omite los excluidos.                   |

Tipos finales permitidos: `COVER`, `EXECUTIVE_SUMMARY`, `CONTEXT`, `PROBLEM`,
`OBJECTIVES`, `SOLUTION`, `SCOPE`, `DELIVERABLES`, `ARCHITECTURE`,
`ALTERNATIVES`, `TIMELINE`, `INVESTMENT`, `TERMS`, `EXCLUSIONS`, `NEXT_STEPS`,
`REFERENCE` y `CUSTOM`. Los valores existentes siguen siendo válidos; no se
renombran en una migración destructiva.

El contenido seguirá siendo texto plano con saltos semánticos. Cada tipo tendrá
un schema Zod con una allowlist de claves de metadata, longitudes máximas y
valores primitivos. Por ejemplo, `COVER` podrá aceptar una etiqueta y
`TIMELINE` una referencia de presentación, pero no campos económicos ni HTML.

### PR 3 — conceptos económicos y alternativas

`ProposalLineItem` sigue ligado a una revisión y opcionalmente a una
alternativa. Se amplía para que una cotización sea explicable, sin mezclar el
costo interno con el público:

| Campo                       | Regla                                                                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`                      | Nombre corto del concepto, público y obligatorio. `description` conserva el detalle.                                                                                  |
| `unit`                      | Unidad legible, por ejemplo `hora`, `usuario`, `dispositivo` o `ubicación`.                                                                                           |
| `billingPeriod`             | Enum independiente: `ONE_TIME`, `MONTHLY`, `ANNUAL`. Permite que la periodicidad no se infiera del texto.                                                             |
| `isOptional` / `isIncluded` | Booleanos explícitos para la semántica comercial. Un concepto incluido no es facturable; uno opcional no entra al total hasta que se aplique la regla de alternativa. |
| `contingency`               | Decimal interno opcional, no serializable públicamente.                                                                                                               |
| `provider`                  | Texto interno opcional, no serializable públicamente.                                                                                                                 |

`ProposalLineItemType` se extiende de forma aditiva con `HOURLY`, `PER_USER`,
`PER_DEVICE` y `PER_LOCATION`; los tipos existentes se preservan para datos
históricos. En la UI nueva, el tipo describe la unidad comercial mientras
`billingPeriod`, `isOptional` e `isIncluded` expresan reglas separadas.

La utilidad estimada se calcula en servidor a partir de precio, descuento,
impuesto aplicable, costo y contingencia. No se persistirá como un valor de
cliente ni se expondrá fuera de administración. Si se requiere persistencia
para auditoría interna, se añadirá en un PR posterior con acceso exclusivamente
administrativo y no en `metadata`.

`ProposalOption` conserva sus claves únicas por revisión y adopta códigos de
lista permitida: `CORE`, `OPERATION`, `SCALE`, `CUSTOM`. Se añaden campos
públicos estructurados para `estimatedTime`, `support`, `terms` y
`availability`, todos validados y limitados. Sus conceptos se relacionan a
través de `ProposalLineItem.optionId` existente. Una aceptación con más de una
alternativa disponible exige una `optionId` válido.

### PR 4 — cronograma y comentarios de revisión

Se añade `ProposalTimelinePhase` ligado a `revisionId`:

`id`, `revisionId`, `key`, `position`, `title`, `description`,
`durationValue`, `durationUnit`, `dependencyKey`, `estimatedStartAt?` y
`deliverableKeys Json?`.

`dependencyKey` sólo puede referir una fase de la misma revisión; no crea aún
un proyecto operativo. Al aceptar, esta estructura podrá copiarse más adelante
como plantilla, nunca tratarse como avance real.

`ProposalComment` gana relaciones opcionales y verificadas con el mismo
`revisionId`: `sectionId`, `optionId`, `lineItemId`, además de un enum de estado
de comentario (`OPEN`, `ACKNOWLEDGED`, `RESOLVED`). Un comentario puede apuntar
a cero o una entidad concreta, no a varias. Solicitar cambios registra una
decisión/evento y requiere una nueva revisión administrativa; el comentario no
altera contenido ni estado por sí solo.

### PR 5 — vista previa administrativa

No requiere una tabla nueva. `/admin/propuestas/[proposalId]/preview` obtiene
la revisión seleccionada mediante el mismo builder de DTO público, pero sólo
después de autorización de administrador. Muestra `ADMIN_PREVIEW` y nunca crea
invitaciones ni eventos de lectura de cliente. Abrirla registra
`PREVIEW_OPENED` con metadata interna mínima y sin contenido económico privado.

### PR 6 — documentos y constancia

Se propone una tabla privada `ProposalDocument`:

`id`, `proposalId`, `revisionId`, `acceptanceId?`, `kind`, `contentHash`,
`storageKey`, `fileName`, `mimeType`, `sizeBytes`, `generatedAt`,
`generatedById?` y `downloadedAt?`.

`kind` será `PROPOSAL_PDF` o `ACCEPTANCE_CERTIFICATE`. La constancia refiere
además a la `ProposalAcceptance` existente, cuyo snapshot queda como fuente
inmutable. Los binarios se guardan mediante un adaptador de almacenamiento
privado, fuera de `public/`; la tabla sólo almacena una clave opaca, nunca una
URL pública permanente.

## Migraciones y despliegue

| PR  | Migración propuesta                                                                                                                                                                                                | Estrategia segura                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2   | Añadir valores del enum `ProposalSectionType`; añadir `ProposalSection.key` primero nullable; backfill determinista `section-<position>` por revisión; hacerlo obligatorio y añadir `@@unique([revisionId, key])`. | Una única migración revisada para PostgreSQL. No cambia posiciones ni borra contenido histórico.                                                                       |
| 3   | Añadir valores aditivos a `ProposalLineItemType`; crear enum `ProposalBillingPeriod`; añadir campos públicos/internos de concepto y campos estructurados de alternativa.                                           | Añadir campos inicialmente nullable o con defaults compatibles; backfill sólo donde sea inequívoco. Cálculos siguen usando datos existentes durante la transición.     |
| 4   | Crear `ProposalTimelinePhase`, enums de duración/estado y FKs opcionales de `ProposalComment`.                                                                                                                     | Crear índices para `revisionId, position` y las FKs; validar que la entidad comentada pertenece a la misma revisión en dominio, ya que una FK aislada no lo garantiza. |
| 5   | Ninguna, salvo que la auditoría necesite un tipo de evento nuevo.                                                                                                                                                  | La preview consume datos, no los duplica.                                                                                                                              |
| 6   | Crear `ProposalDocument`, enum de tipo documental y tipos de evento.                                                                                                                                               | Migrar antes de activar descarga; storage privado se configura y verifica antes de escribir el primer binario.                                                         |

Cada PR incluirá `prisma migrate deploy` en el entorno objetivo, `prisma
generate`, pruebas de lectura de datos anteriores y un plan de rollback que
desactiva la UI nueva sin intentar eliminar valores de enum en producción.

## Contrato público: DTO explícito

Se creará `lib/proposals/public-dto.ts` como única frontera entre Prisma y
Project Room, preview o generador de PDF. No habrá `include` completo seguido
de una eliminación manual de campos. Las consultas públicas usarán `select`
con allowlist y el builder transformará los `Decimal` a strings canónicos.

```ts
type PublicProposalRevisionDTO = {
  proposal: { reference: string; currency: string; validUntil: string | null };
  revision: { id: string; number: number; title: string; introduction: string | null };
  sections: PublicProposalSectionDTO[];
  alternatives: PublicProposalAlternativeDTO[];
  lineItems: PublicProposalLineItemDTO[];
  timeline: PublicProposalTimelinePhaseDTO[];
  totals: { subtotal: string; tax: string; total: string };
  terms: string | null;
  contentHash: string;
};
```

El DTO sólo contendrá el nombre y descripción públicos del cliente cuando la
página privada ya tenga autorización de invitación. Nunca contendrá
`internalCost`, `markupPercent`, `contingency`, `internalNotes`, `provider`,
utilidad estimada, hashes de invitación/código, IP, `userAgent`, autores
internos o metadata no permitida.

El mismo builder recibirá el contexto (`invite`, `admin preview`, `accepted
snapshot`) y devolverá datos idénticos en contenido público. El snapshot de
aceptación se deriva de este DTO canónico con la alternativa elegida; no de la
vista React. Pruebas de tipo y de serialización deben afirmar expresamente que
las claves internas no existen.

## Estrategia de render y PDF

1. PR 5 extrae componentes de lectura puramente presentacionales que reciben
   `PublicProposalRevisionDTO`; Project Room y `ADMIN_PREVIEW` los reutilizan.
2. PR 6 crea un `ProposalDocumentViewModel` a partir del mismo DTO, congelado
   con `contentHash`, número de revisión y fecha de generación.
3. El PDF se renderiza en servidor con un renderer determinista compatible con
   Node (a evaluar en un spike aislado: `@react-pdf/renderer`), con fuentes
   licenciadas/embebibles y el logo vectorial JANVIER. Nunca se imprime el DOM
   del navegador ni se depende de CSS de la página.
4. Antes de almacenar, se valida que el `contentHash` del modelo coincide con
   la revisión/snapshot objetivo. La descarga se autoriza por admin o por una
   invitación válida, y se registra sin exponer la clave de storage.
5. La constancia usa exclusivamente `ProposalAcceptance.snapshot`,
   `contentHash`, alternativa e identidad registrada al aceptar. Su título es
   **Constancia de aceptación comercial**; no afirma ser firma electrónica
   avanzada.

## Eventos de auditoría

Los PR introducirán de forma aditiva estos valores de `ProposalEventType` y
usarán el escritor de eventos ya centralizado:

`PROPOSAL_SECTION_CREATED`, `PROPOSAL_SECTION_UPDATED`,
`PROPOSAL_SECTION_REMOVED`, `LINE_ITEM_CREATED`, `LINE_ITEM_UPDATED`,
`LINE_ITEM_REMOVED`, `OPTION_UPDATED`, `TIMELINE_UPDATED`, `PREVIEW_OPENED`,
`PDF_GENERATED`, `PDF_DOWNLOADED`, `SECTION_COMMENTED` y
`ACCEPTANCE_CERTIFICATE_GENERATED`.

La metadata de evento contiene IDs, tipo de operación y conteos; no contiene
costos internos, texto completo de la propuesta, tokens ni datos de aceptación
que no sean necesarios para auditoría.

## Riesgos y controles

| Riesgo                                                    | Control                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Un enum PostgreSQL es difícil de revertir.                | Sólo valores aditivos, migraciones pequeñas, UI compatible antes y después de desplegar.                                  |
| Una reescritura masiva rompe una revisión compartida.     | El editor sólo muta `DRAFT` desbloqueado; compartir y aceptar continúan pasando por `proposal-state`.                     |
| El reordenamiento cambia la identidad de una sección.     | `key` persistente, `position` como orden derivado y pruebas de reordenamiento.                                            |
| Datos internos se filtran por una consulta Prisma amplia. | DTO y `select` público explícito, pruebas de ausencia de claves y PDF construido desde DTO.                               |
| Totales inconsistentes entre web, preview y PDF.          | Una función de cálculo con `Decimal` y una representación canónica común.                                                 |
| PDF visualmente distinto o no reproducible.               | Renderer de servidor, assets versionados, content hash y pruebas de contenido antes de una comparación visual controlada. |
| Archivo privado expuesto por URL o `public/`.             | Adaptador de storage privado, claves opacas, descarga autenticada/autorizada y auditoría.                                 |
| El cronograma parece seguimiento operativo.               | Modelo separado, etiqueta comercial y ninguna escritura en `Project` al editar una propuesta.                             |
| Editor largo causa errores móviles o overflow.            | Controles por teclado, botones de mover, límites de longitud y E2E de 320 px en ambos temas.                              |

## Criterios de aceptación por PR

### PR 2 — bloques y editor estructurado

- Un `DRAFT` puede crear, eliminar y reordenar los tipos de bloque aprobados
  con teclado y puntero, sin saltos manuales ni HTML libre.
- Cada bloque guarda `key`, tipo, posición, título, contenido, visibilidad y
  metadata validada; posiciones y claves son únicas por revisión.
- Las revisiones compartidas/aceptadas no son editables; no hay escritura
  directa de estados.
- El contenido visible no depende de JavaScript para existir y no hay overflow
  a 320 px; neutral y night comparten estructura y accesibilidad.
- Unit tests cubren schema, orden y rechazo de metadata inválida; E2E cubre
  edición, guardado, reordenamiento y navegación administrativa.

### PR 3 — conceptos y alternativas

- Los conceptos admiten los tipos, unidad, periodicidad, impuesto individual,
  opcional/incluido y alternativa indicados; subtotal, impuesto y total se
  calculan sólo con `Decimal` en servidor.
- Las alternativas `CORE`, `OPERATION`, `SCALE` y `CUSTOM` se comparan de forma
  clara; una propuesta con varias alternativas no se acepta sin selección.
- Datos de costo, markup, contingencia, proveedor, notas y utilidad no llegan
  a Project Room, DTO, snapshot público ni PDF.

### PR 4 — cronograma y comentarios

- Fases comerciales ordenadas, dependencias de la misma revisión y fechas
  opcionales se muestran sin afirmar que son avance de proyecto.
- Un comentario puede asociarse a propuesta, sección, alternativa o concepto;
  no modifica por sí solo contenido ni estado.

### PR 5 — preview

- `/admin/propuestas/[proposalId]/preview` requiere sesión administrativa,
  muestra `ADMIN_PREVIEW`, no crea invitación y coincide con la vista de
  cliente para la misma revisión/alternativa en neutral, night, desktop y
  móvil.

### PR 6 — PDF y constancia

- El PDF usa revisión, `proposalId`, `revisionId` y `contentHash` coincidentes;
  incluye información comercial aprobada y omite todos los campos internos.
- La constancia reproduce el snapshot aceptado, alternativa, importes, moneda,
  impuestos, términos, fecha, IP y método de verificación, sin reclamar firma
  electrónica avanzada.
- Ningún archivo privado se escribe en `public/`; generación, descarga y
  constancia se auditan.

## Orden de implementación

1. **PR 2:** migración de `ProposalSection`, schemas Zod, editor reordenable y
   eventos de sección.
2. **PR 3:** campos/enum económicos, cálculo central extendido, editor de
   alternativas y DTO con pruebas de no filtración.
3. **PR 4:** cronograma, relaciones opcionales de comentarios y reglas de
   dominio.
4. **PR 5:** DTO público definitivo y preview administrativa que comparte la
   lectura de cliente.
5. **PR 6:** spike del renderer, `ProposalDocument`, PDF, constancia y storage
   privado.

PR 2 no debe adelantar campos económicos, cronograma, PDF ni constancia: su
responsabilidad es dejar una estructura editorial estable sobre la que los
siguientes PR puedan trabajar sin un diff monolítico.
