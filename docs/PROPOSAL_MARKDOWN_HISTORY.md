# Hito G — historial, reimportación y plantillas Markdown

El historial editorial opera exclusivamente sobre `ProposalMarkdownCheckpoint`.
Cada checkpoint conserva el Markdown normalizado, su SHA-256, versión del parser,
diagnósticos y razón. No almacena HTML, MDAST crudo ni activos duplicados.

## Flujo administrable

- La importación y el autosave existentes siguen creando checkpoints.
- El panel **HISTORY / CHECKPOINTS** permite comparar un checkpoint contra la
  fuente actual mediante un diff determinista por línea.
- Restaurar nunca muta el checkpoint original: lo vuelve a pasar por el parser
  vigente y, sólo si es válido, crea un checkpoint `RESTORE` y actualiza el
  borrador con control optimista de versión/hash.
- Las plantillas `software-project` y `technology-supply` viven en código,
  son Markdown JANVIER permitido y se aplican como `TEMPLATE_APPLIED`.
- Todo el flujo rechaza revisiones bloqueadas o propuestas fuera de `DRAFT`.

No hay merge automático: comparar y restaurar son explícitos para no mezclar
documentos comerciales de forma silenciosa.

## Retención

`npm run proposals:prune-markdown-checkpoints` sólo informa los candidatos.
Para ejecutar la operación explícita y auditable:

```bash
npm run proposals:prune-markdown-checkpoints -- --apply
```

La tarea se ejecuta fuera de solicitudes web y registra `PROPOSAL_EDITED` con
los IDs eliminados y retenidos. Conserva siempre `IMPORT`, `PRE_SHARE`,
`RESTORE` y `REVISION_CLONED`, el último `MANUAL_SAVE` y como máximo los 20
checkpoints automáticos recientes por fuente. La tabla no tiene referencias
externas a checkpoints en V1; si Hito H añade una, la tarea deberá excluirlos
antes de permitir cualquier borrado.

## Fronteras

Hito G no comparte el Markdown con Project Room, no congela variables, no crea
hashes de aceptación ni altera snapshots o PDFs. Eso pertenece exclusivamente
a Hito H.
