# Hito H — expediente Markdown congelado

Al compartir por primera vez una revisión Markdown, JANVIER crea un expediente
`markdown-first-v1` dentro de la misma transacción que bloquea la revisión,
crea el checkpoint `PRE_SHARE`, emite la invitación y realiza la transición
`DRAFT → SENT`.

## Paquetes y hashes

`ProposalRevision.frozenPublicDocument` contiene únicamente el documento
renderizable para cliente, variables ya resueltas, DTO comercial público,
vigencia y revisión. Su hash SHA-256 se calcula sobre JSON canónico y se guarda
como `publicContentHash`.

`ProposalRevision.frozenPrivateEvidence` conserva el expediente interno:
Markdown original, `sourceHash`, versión del parser, AST normalizado,
documento administrativo (incluidas secciones `janvier-internal`), manifiesto
completo de activos y metadatos de generación. `evidenceHash` cubre ese paquete
y el `publicContentHash`.

Por diseño, modificar un dato interno cambia sólo `evidenceHash`; modificar
cualquier dato visible cambia ambos hashes. La aceptación `markdown-first-v1`
referencia ambos hashes y el checkpoint `PRE_SHARE`. La base de datos impide
borrar ese checkpoint mientras una aceptación lo referencia.

## Inmutabilidad operativa

El Project Room sólo entra al renderer congelado cuando la revisión contiene un
paquete válido. Allí usa alternativas, variables, vigencia y texto del paquete;
no vuelve a resolver Client, fecha actual, fuente Markdown ni precio vivo. La
selección de alternativa se valida contra las alternativas congeladas. Las
propuestas históricas sin paquete continúan usando `project-room-v1`.

Las referencias de activos siguen siendo privadas y sus hashes forman parte del
manifiesto público o privado según corresponda. Nunca se guarda Markdown,
secciones internas ni evidencia privada dentro del DTO enviado al cliente.

## Retención y verificación

`scripts/proposals/prune-markdown-checkpoints.ts` respeta la política previa y
además excluye checkpoints con aceptaciones de evidencia. Ejecutar primero sin
`--apply`; el modo aplicado registra una operación auditable.

Validaciones mínimas:

```powershell
npm run check
npm run build
npx prisma migrate deploy
npx prisma migrate deploy
```

Las pruebas unitarias `proposal-markdown-freeze` cubren independencia entre el
hash público y notas internas, y cambio conjunto ante contenido visible.
