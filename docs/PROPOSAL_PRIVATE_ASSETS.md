# Activos privados de propuestas

El Hito D guarda imágenes asociadas a una `ProposalRevision` sin usar
`public/`, URLs de almacenamiento, ni bytes dentro de PostgreSQL.

## Modelo y límites

`ProposalAssetBlob` es el archivo normalizado e inmutable. Se identifica con
`sha256`, tiene una `storageKey` privada y puede tener varias referencias.
`ProposalAsset` pertenece a una revisión y contiene el alias Markdown,
metadatos editoriales, texto alternativo y estado de retiro. Clonar una
revisión copia las referencias activas y reutiliza los mismos blobs.

La primera implementación usa `LocalPrivateAssetStorage`, detrás de la
interfaz `ProposalAssetStorage`. El siguiente proveedor (S3 compatible) debe
implementar `put`, `open`, `exists` y `delete`; no debe cambiar el modelo ni
filtrar una clave de almacenamiento a un navegador.

- Formatos: PNG, JPEG y WebP estáticos.
- Máximo por archivo: 15 MiB antes y después de la normalización.
- Máximo por revisión: 50 activos activos y 150 MiB.
- Máximo de dimensiones: 12 000 px por eje y 60 megapíxeles.
- Entrega segura: variante sin metadatos, rotación EXIF aplicada y máximo de
  4096 px por eje. No se aceptan SVG, vídeo, audio ni documentos.

La carga verifica extensión, MIME declarado, magic bytes, contenedor completo
y decodificación con Sharp. El SHA-256 se calcula sobre la variante segura,
por lo que dos cargas equivalentes reutilizan un blob.

## Flujo editorial

Dentro de Markdown se referencia una imagen así:

```md
![Diagrama de arquitectura](asset:architecture-diagram)
```

El editor sólo permite cambiar activos en una revisión `DRAFT`. El alias se
normaliza a minúsculas, números y guiones. Si un alias ya aparece en Markdown,
el administrador debe confirmar que cambiarlo no reescribe automáticamente la
fuente. Retirar un activo es un soft delete de la referencia; conserva las
revisiones históricas. Los activos decorativos usan `alt=""`; los informativos
requieren texto alternativo.

La tarjeta `PRIVATE_ASSETS` muestra referencias faltantes, no usadas y ALT
pendiente. Una propuesta no se comparte si uno de sus activos `required` fue
retirado o no está referenciado en el documento actual.

## Entrega y seguridad

El renderer sólo recibe un manifiesto validado. Sus URLs son
`/api/proposals/assets/:assetId`; no contienen `storageKey`. La ruta exige una
sesión administrativa en este hito, sirve el MIME real, `ETag`,
`Cache-Control: private`, `X-Content-Type-Options: nosniff` y no permite que
un origen externo mutile activos. La futura entrega a cliente se añadirá con
una autorización de Project Room, no cambiando los blobs a públicos.

Las mutaciones usan una comprobación same-origin, limitador acotado por actor y
una segunda comprobación de que la revisión sigue en `DRAFT` dentro de la
transacción. Las operaciones de carga, reutilización, edición, reemplazo,
retiro, restauración, clonación, acceso y recolección quedan registradas en
`ProposalEvent`.

## Configuración Docker

La aplicación requiere estas variables en producción:

```env
PROPOSAL_ASSET_STORAGE_DRIVER="local"
PROPOSAL_ASSET_STORAGE_PATH="/var/lib/janvier/proposal-assets"
PROPOSAL_ASSET_MAX_FILE_BYTES="15728640"
PROPOSAL_ASSET_MAX_REVISION_BYTES="157286400"
PROPOSAL_ASSET_GC_GRACE_DAYS="30"
```

`compose.yaml` monta esa ruta como el volumen nombrado
`janvier_proposal_assets`. Detener el sistema conserva tanto ese volumen como
`janvier_postgres`; `finalizar --remove-data` elimina ambos de forma
intencionada. Los scripts de inicio completan las variables en un `.env`
existente que venga de una versión anterior.

## Operación: backup, restauración y GC

La preview administrativa de Hito F reutiliza el manifiesto público autorizado
y la entrega autenticada de este hito; no recibe `storageKey` ni URLs físicas.

Un respaldo coherente incluye la base y el volumen de blobs. Ejecuta los dos
pasos durante una ventana de mantenimiento o contra un snapshot consistente:

```bash
docker compose exec -T database pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/janvier.sql
npm run proposals:backup-assets -- --output /ruta/segura/janvier-proposal-assets
```

Restaura primero PostgreSQL y después sólo los blobs que falten:

```bash
npm run proposals:restore-assets -- --input /ruta/segura/janvier-proposal-assets
```

El backup verifica todos los SHA-256 antes de copiar. La restauración verifica
el manifiesto y nunca sobrescribe un blob existente.

Los blobs sin referencias activas sólo se purgan después de 30 días por defecto:

```bash
npm run proposals:gc-assets
npm run proposals:gc-assets -- --execute
```

El primer comando es siempre `dry-run`. El segundo toma un lock de fila sobre
cada blob, vuelve a comprobar que todas sus referencias llevan retiradas el
período de gracia, borra el archivo y luego la fila en una transacción. Nunca
se ejecuta GC durante una solicitud web normal. Revisa los eventos
`PROPOSAL_ASSET_GC_DELETED` y `PROPOSAL_ASSET_GC_FAILED` y el código de salida
del script en la monitorización del servidor.

## Verificación de Hito D

Las pruebas unitarias cubren magic bytes, decodificación, normalización, hash,
manifiesto público sin clave de almacenamiento, auditoría de referencias y
encapsulamiento de rutas de disco. Las E2E cubren la carga privada,
representación por alias y la denegación sin sesión administrativa.
