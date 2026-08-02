# Desarrollo de JANVIER V2

El módulo de entrega de propuestas privadas está definido en
[`CLIENT_PROPOSAL_ROOM.md`](./CLIENT_PROPOSAL_ROOM.md). Se implementará sobre el
núcleo de datos y administración; no debe degradarse a una descarga PDF como
experiencia primaria.

## Requisitos

- Docker Desktop para Windows o Docker Engine con Docker Compose V2 en macOS y
  Linux.
- Node.js 22.12 o superior únicamente si se trabajará fuera de Docker.
- npm 10 o superior únicamente si se trabajará fuera de Docker.

## Inicio local recomendado

La V2 tiene un entorno Docker completo de desarrollo: Next.js, PostgreSQL,
migraciones y dependencias reproducibles.

### Windows

Desde PowerShell, en la raíz del proyecto:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\windows\ejecutar.ps1
```

### macOS y Linux

```bash
bash scripts/unix/ejecutar.sh
```

El primer arranque crea `.env` si es necesario, genera el secreto local, levanta
PostgreSQL, aplica las migraciones y abre la V2 en `http://localhost:3001`.
The maintenance task also validates legacy Markdown sources before seeding, so
`legacy-generated-v1` is not marked valid without the JANVIER parser.

Para actualizar dependencias bloqueadas, imágenes y migraciones, usar
`actualizar.ps1` en Windows o `bash scripts/unix/actualizar.sh` en macOS/Linux.
Para detener el entorno sin borrar datos, usar `finalizar.ps1` o
`bash scripts/unix/finalizar.sh`. Consulta la guía completa en
[`scripts/README.md`](../scripts/README.md).

El legado conserva el puerto 3000. La V2 usa 3001 en desarrollo para permitir
ejecutar ambas aplicaciones.

## Ejecución sin Docker

También se puede ejecutar la aplicación sin Docker, siempre que `.env` tenga
una `DATABASE_URL` PostgreSQL válida y se hayan aplicado las migraciones:

```text
npm install
npm run db:bootstrap
npm run dev
```

For an initialized deployment, the equivalent sequence is:

```text
npm run prisma:deploy
npm run proposals:backfill-markdown
```

The second command accepts `-- --dry-run`, does not change commercial state or
acceptances, and returns a failure code for an inconsistent historic SHA-256.

## Calidad

```text
npm run typecheck
npm run lint
npm run format
npm run test
npm run check
```

Los cambios de base de datos requieren una migración y un plan de rollback
documentado. La producción se desplegará sin Docker, mediante el proceso Ubuntu
definido en el plan maestro.
