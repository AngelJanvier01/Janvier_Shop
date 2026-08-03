# JANVIER V2

Sitio público, Control Room y Project Room de JANVIER. La V2 usa Next.js,
PostgreSQL, propuestas Markdown verificables y activos privados fuera de
`public/`.

## Desarrollo local

Requisitos: Node 22+, npm 10+ y Docker Desktop para PostgreSQL.

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\windows\ejecutar.ps1
```

Sitio: `http://localhost:3001` · PostgreSQL: `localhost:5432`.

Validación antes de integrar cambios:

```bash
npm run check
npm run build
npm run test:e2e:production
```

## Producción

La imagen de producción es multi-stage y se ejecuta sin montajes del
repositorio ni modo de desarrollo. Copia `.env.production.example` a
`.env.production`, define secretos únicos y sigue
[`docs/RELEASE_CHECKLIST.md`](docs/RELEASE_CHECKLIST.md):

```bash
bash scripts/unix/production-deploy.sh
```

El servicio web escucha solamente en `127.0.0.1`; Nginx o Caddy debe terminar
HTTPS. Los datos de PostgreSQL y activos de propuestas usan volúmenes separados.

## Operación

- Backup: `bash scripts/unix/production-backup.sh /ruta/segura`.
- Health: `GET /api/health` valida aplicación y PostgreSQL.
- La documentación del Project Room, activos y propuesta congelada está en
  `docs/`.

## Legado

El directorio `backend/` y los HTML históricos no forman parte de la imagen ni
del despliegue V2. Se conservan únicamente como material histórico hasta su
retiro explícito.
