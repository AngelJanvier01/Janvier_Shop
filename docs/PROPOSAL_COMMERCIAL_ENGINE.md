# Proposal Studio - Commercial Engine

**Estado:** Hito E / `PROPOSAL_STUDIO_COMMERCIAL_ENGINE`.

Markdown conserva la narrativa editorial. PostgreSQL es la fuente autoritativa
de alternativas, conceptos, precios, impuestos, cronograma, condiciones y
pagos propuestos. Este hito no comparte todavia el nuevo documento por Project
Room, no crea PDF/DOCX/CRM/pagos reales y no calcula hashes finales.

## Auditoria previa y compatibilidad

| Modelo               | Contrato V1 conservado                                         | Extension Hito E                                                                            |
| -------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `Proposal`           | referencia, cliente, estado, moneda y vigencia de Project Room | se mantiene sin reemplazarlo                                                                |
| `ProposalRevision`   | titulo, introduccion, terminos, bloqueo y relacion Markdown    | moneda, vigencia, condiciones, politica fiscal y `commercialVersion` por revision           |
| `ProposalOption`     | `isEnabled`, `recommended`, `investment`                       | estado activo, duracion, soporte, condiciones y archivo                                     |
| `ProposalLineItem`   | `type`, descuento fijo y campos leidos por snapshots V1        | unidad, tipo de cobro, alcance, descuentos tipados, impuestos, precio/costo/markup y estado |
| `ProposalSection`    | bloques y sincronizacion Markdown                              | se conserva; Markdown inserta marcadores cerrados                                           |
| `ProposalAcceptance` | snapshot/hash V1 aceptado                                      | no se recalcula ni se modifica                                                              |
| `ProposalEvent`      | auditoria previa                                               | altas, ediciones, archivos y conflictos comerciales sin costos en metadata                  |

La migracion `20260802110000_proposal_commercial_engine` es aditiva. Copia
moneda/vigencia de `Proposal` a cada revision, mapea descuento historico a
`FIXED_AMOUNT`, y marca lineas sin alternativa como `COMMON`. No inventa
conceptos para inversiones V1, ni altera snapshots o aceptaciones.

## Modelo

```text
ProposalRevision
 ├── ProposalOption (maximo 12 activas)
 ├── ProposalLineItem (maximo 500; COMMON u OPTION_SPECIFIC)
 ├── ProposalTimelinePhase (maximo 100)
 │    ├── ProposalTimelineDeliverable
 │    └── ProposalTimelineDependency -> fase de la misma revision
 └── ProposalPaymentStage (maximo 20)
```

Una propuesta usa una moneda ISO-4217 de tres letras (por defecto `MXN`) y no
hay conversion automatica. Cantidad: `Decimal(18,4)`; importes:
`Decimal(18,2)`; porcentajes: `Decimal(9,4)`.

## Calculo centralizado

`lib/proposals/commercial-calculator.ts` es la unica implementacion de las
formulas y fija `commercialCalculationVersion = "janvier-commercial-v1"`.
Usa `Prisma.Decimal`, nunca `number` o `float`, y redondea cada resultado
monetario a dos decimales con `ROUND_HALF_UP`.

```text
adjustedCost       = internalCost * (1 + contingencyPercent / 100)
suggestedUnitPrice = adjustedCost * (1 + markupPercent / 100)

baseAmount     = quantity * unitPrice
discountAmount = percentage ? baseAmount * value / 100 : fixedAmount
afterDiscount  = baseAmount - discountAmount
netAmount      = taxIncluded ? afterDiscount / (1 + taxRate / 100) : afterDiscount
taxAmount      = included ? afterDiscount - netAmount : netAmount * taxRate / 100
totalAmount    = netAmount + taxAmount
```

`markupPercent` es siempre recargo sobre costo. El margen bruto solo es una
metrica calculada: `grossProfit / netAmount * 100`. Costo 1,000 con markup 40
por ciento produce precio 1,400 y margen bruto 28.5714 por ciento.

Lineas `INCLUDED` pueden conservar costo pero tienen total cero. Las
`OPTIONAL` se muestran aparte y solo entran con seleccion explicita. Los
totales de pago unico, mensual y anual se mantienen en cubetas separadas.

## Alternativas, cronograma y pagos

- `COMMON` no tiene alternativa; `OPTION_SPECIFIC` debe tener una alternativa
  de la misma revision.
- Una alternativa activa requiere un concepto publico especifico; como maximo
  una activa puede ser recomendada.
- El cronograma usa un grafo dirigido y rechaza dependencia inexistente, entre
  revisiones o ciclica. Sus entregables son promesas comerciales, no tareas.
- Pagos soportan `PERCENTAGE`, `FIXED_AMOUNT` y un unico `REMAINDER`. Solo
  calendarizan el total de pago unico: no crean pagos ni instrucciones
  bancarias.

## DTO publico y Markdown

`buildPublicProposalCommercialDto` es una allowlist para ADMIN_PREVIEW y el
cliente futuro. Incluye conceptos visibles, alternativas activas, cronograma,
pagos, moneda, condiciones y totales. No contiene `internalCost`, markup,
contingencia, proveedor, notas internas, margen, utilidad ni precio sugerido.
La asercion de privacidad inspecciona la serializacion completa.

Marcadores permitidos solo como parrafo completo:

```md
{{proposal.options}}
{{proposal.lineItems}}
{{proposal.timeline}}
{{proposal.paymentSchedule}}
{{proposal.totals}}
```

El renderer recibe AST JANVIER seguro y DTO validado, nunca Markdown crudo,
HTML/HAST ni filas de base. Sin datos, ADMIN muestra un placeholder explicito;
ADMIN_PREVIEW no inventa cifras.

## Edicion, concurrencia y auditoria

Solo una sesion admin puede editar una revision `DRAFT`, desbloqueada y cuya
propuesta siga `DRAFT`. Toda mutacion envia `expectedCommercialVersion`; la
transaccion reclama primero esa version y la incrementa. Una pestana
desactualizada recibe `CONFLICT` sin sobrescribir datos. El estudio usa autosave
con debounce de 1.2 segundos y estados `PENDING`, `SAVING`, `SAVED`,
`CONFLICT` y `ERROR`.

Eventos guardan ID, entidad y nombres de campos; nunca costos o notas sensibles
completas. Para reordenar no se violan indices unicos: las posiciones existentes
se desplazan temporalmente antes de aplicar el nuevo orden.

## Pendiente

Congelar variables al compartir, Project Room Markdown, hashes publico/evidencia,
snapshot V2, constancia de aceptacion, PDF/DOCX, CRM, pagos y convertir fases en
tareas son hitos posteriores.

La preview formal de Hito F reutiliza este DTO y el calculator central para
simular alternativa y opcionales sin persistir una selección comercial.

## Validacion de cierre

- `npm run check`: 15 archivos y 62 pruebas unitarias correctas.
- `npm run build`: compilacion optimizada correcta.
- E2E productivo con `PROJECT_ROOM_E2E=1`: 33 correctas, una omitida de catalogo
  que requiere su flag propio. Incluye Project Room, Markdown, activos privados,
  el motor comercial y la matriz responsive existente de 320 a 1920 px.
- `prisma migrate deploy` se ejecuto dos veces sobre la base local con datos V1,
  sin migraciones pendientes. Una base PostgreSQL temporal vacia aplico las diez
  migraciones y una segunda ejecucion tambien quedo sin pendientes.
- La imagen Docker `janvier-v2-commercial-engine:local` construyo correctamente.
- El respaldo PostgreSQL posterior a la migracion se genero en
  `backups/janvier-hito-e-commercial-engine-20260802.dump` (ignorado por Git).

### Advertencia de pg bajo carga E2E

Mensaje exacto:

```text
DeprecationWarning: Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0. Use async/await or an external async flow control mechanism instead.
```

Se reproduce al ejecutar toda la suite E2E productiva con 14 workers paralelos.
No aparece al ejecutar de forma aislada la prueba comercial con
`NODE_OPTIONS=--trace-deprecation`; tampoco hay llamadas propias a
`pg.Client#query` en la aplicacion. La unica integracion es `PrismaPg` de
`@prisma/adapter-pg`, que crea el pool usado por Prisma. No afecta la ejecucion:
las 33 pruebas completan correctamente.

Se clasifica como advertencia externa no bloqueante del adaptador Prisma/pg bajo
concurrencia, no como una excepcion comercial. Seguimiento: `JAN-TECH-014`.
Antes de produccion se debe repetir la suite contra la siguiente version
compatible de `pg` y `@prisma/adapter-pg`; si el aviso aparece fuera de la
ejecucion paralela de pruebas, capturar una traza y abrir un incidente bloqueante.
