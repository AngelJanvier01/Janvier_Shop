# Checklist de publicación JANVIER V2

## Antes de tocar el servidor

- Ejecutar `npm run check`, `npm run build` y `npm run test:e2e:production`.
- Crear una copia segura de `.env.production`; nunca reutilizar el `.env` local.
- Generar secretos únicos: `openssl rand -base64 48` para `AUTH_SECRET` y una
  contraseña independiente para PostgreSQL y administración.
- Confirmar que `NEXT_PUBLIC_SITE_URL` usa el dominio final con `https://`.
- Mantener el backend legado fuera de Docker y fuera del proxy V2.

## Servidor Ubuntu

1. Instalar Docker Engine y Docker Compose v2.
2. Clonar la rama aprobada y copiar `.env.production.example` a
   `.env.production` con permisos `600`.
3. Ejecutar `bash scripts/unix/production-deploy.sh`.
4. Configurar Nginx o Caddy como proxy HTTPS hacia `127.0.0.1:3001`. El puerto
   de JANVIER no se publica en todas las interfaces.
5. Verificar `https://tu-dominio/api/health`, inicio, contacto, admin y una
   invitación privada real de prueba.

## Backup y observación

- Ejecutar diariamente `bash scripts/unix/production-backup.sh /ruta/segura`.
- Copiar los dumps y archivos de activos a almacenamiento externo cifrado.
- Probar una restauración antes de depender del backup.
- Revisar `docker compose -f compose.production.yaml logs --tail=200 web` y
  `docker stats` después de publicar. Los límites iniciales son 512 MiB para
  PostgreSQL y 512 MiB / 1 CPU para web; ajustar sólo con métricas reales.
- Alertar si `/api/health` devuelve 503, el disco baja de 20 %, o los backups
  no se generan.

## Rollback seguro

No se revierte una migración borrando columnas en producción. Si una versión
falla, volver a la imagen/commit anterior compatible, conservar la base y los
volúmenes, y restaurar sólo desde un respaldo probado si hay corrupción.
