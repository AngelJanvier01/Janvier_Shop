# Proposal Studio Preview

**Estado:** Hito F / `PROPOSAL_STUDIO_PREVIEW`.

La preview formal es una ruta administrativa de solo lectura de negocio:
`/admin/propuestas/[proposalId]/preview`. No comparte, bloquea, crea
invitaciones, snapshots, hashes ni decisiones del cliente.

## Arquitectura y privacidad

```text
ProposalRevision
  -> Markdown AST validado
  -> Public Janvier document AST
  -> Public commercial DTO
  -> Public asset manifest
  -> ProposalPreviewModel
  -> JanvierMarkdownRenderer
```

`ProposalPreviewModel` es una allowlist. Contiene referencia, revisión,
documento público, manifiesto de activos, variables dinámicas, DTO comercial y
readiness. No contiene fuente Markdown, AST normalizado persistido, secciones
internas, costos, markup, contingencia, proveedor, notas, rentabilidad,
`storageKey`, cargador, tokens, hashes, sesiones ni auditoría.

Los activos usan las rutas privadas autenticadas existentes y conservan ETag,
alt, MIME y dimensiones. El manifiesto nunca expone la llave física.

## Variables y simulaciones

Las variables pertenecen a un catálogo cerrado: cliente, propuesta, autor y
`currentDate`. En DRAFT se resuelven sólo para esta lectura, con la zona
`JANVIER_TIMEZONE` (por defecto `America/Mexico_City`). Un valor faltante crea
un diagnóstico; nunca se evalúan expresiones ni caminos dinámicos.

La alternativa y los opcionales son simulaciones no persistentes. Se expresan
en URL segura de preview y el servidor vuelve a componer el DTO usando el
`commercial-calculator` central. Tema y dispositivo son estado local: no
reparsean Markdown, no recalculan importes ni recargan activos.

## Readiness

`DOCUMENT_READINESS` devuelve `INCOMPLETE`, `READY_WITH_WARNINGS` o
`READY_TO_SHARE`. Revisa título, secciones públicas vacías, variables,
marcadores comerciales únicos, activos obligatorios/alt y los mínimos
comerciales de moneda, vigencia, alternativas y conceptos. Los enlaces llevan
al editor con un panel seguro; el validador no cambia `Proposal.status`.

Los marcadores se insertan solamente donde aparecen en Markdown. La preview no
duplica automáticamente alternativas, conceptos, cronograma, pagos o totales.

## Presentación, impresión y controles

La barra indica `ADMIN_PREVIEW` y `DYNAMIC_PREVIEW`, permite elegir revisión,
tema, escritorio/tablet/móvil/full width, refrescar, validar e imprimir un
borrador. `PRESENTATION_MODE` conserva una salida visible, no activa Pointer
Lock y no modifica el cursor. La impresión oculta controles administrativos;
es un borrador legible, no un PDF oficial.

La ruta usa `Cache-Control: private, no-store` y `X-Robots-Tag: noindex,
nofollow`. La navegación, selector, controles y panel de diagnósticos tienen
etiquetas, foco nativo y controles por teclado. Las tablas siguen contenidas en
su propio scroll horizontal, nunca en el documento global.

## Auditoría y límites

Sólo se registran apertura, cambio de tema/dispositivo, validación explícita y
entrada a presentación. El endpoint exige sesión, mismo origen, que la
revisión pertenezca a la propuesta y aplica 60 eventos/minuto. La metadata no
incluye valores comerciales ni contenido sensible.

No se implementan aún Project Room Markdown, congelación de variables,
evidencia/hash dual, snapshot V2, PDF/DOCX, aceptación, CRM ni pagos reales.
Hito G tratará historial, reimportación, diff y plantillas.

## Validación local

- `npm run check`: 16 archivos de prueba y 65 pruebas unitarias correctas.
- Build optimizado correcto; la ruta y su endpoint administrativo quedan
  server-rendered y sin cache pública.
- E2E productivo con `PROJECT_ROOM_E2E=1`: 34 correctas y una omitida por el
  flag independiente de catálogo. Incluye acceso, cabeceras, privacidad,
  simulación, presentación, impresión invocable, móvil y 50 cambios de tema.
- La migración de auditoría se aplicó dos veces en la base local y se validó,
  junto con las 11 migraciones, desde una base PostgreSQL temporal vacía.
- Imagen local: `janvier-v2-proposal-preview:local`.

La única advertencia conocida sigue siendo la de `@prisma/adapter-pg` bajo los
14 workers paralelos E2E. Está documentada como `JAN-TECH-014` desde Hito E y
no aparece en la prueba aislada de preview.
