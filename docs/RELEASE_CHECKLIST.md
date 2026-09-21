# Checklist de publicación JANVIER V2

## Antes de tocar el servidor

- Ejecutar `npm run check`, `npm run build` y `npm run test:e2e:production`.
- Crear una copia segura de `.env.production`; nunca reutilizar el `.env` local.
- Generar secretos únicos: `openssl rand -base64 48` para `AUTH_SECRET` y una
  contraseña independiente para PostgreSQL y administración.
- Confirmar que `NEXT_PUBLIC_SITE_URL` usa el dominio final con `https://`.
- Configurar `APP_URL` con el mismo origen HTTPS y habilitar
  `TRUST_PROXY_CLIENT_IP=true` únicamente si Cloudflare/Nginx elimina y vuelve a
  crear los encabezados de IP de cliente.
- Configurar SICODD, Gmail y Mercado Pago en `.env.production`; mantener
  `MAIL_ENABLED=false` y los cobros deshabilitados desde administración hasta
  terminar sus pruebas controladas.
- Mantener el backend legado fuera de Docker y fuera del proxy V2.

## Servidor Ubuntu

1. Instalar Docker Engine y Docker Compose v2.
2. Clonar la rama aprobada y copiar `.env.production.example` a
   `.env.production` con permisos `600`.
3. Ejecutar `bash scripts/unix/production-deploy.sh`. Este inicia web,
   sincronización SICODD, correo, vencimientos SPEI y procesamiento de imágenes.
4. Configurar Nginx o Caddy como proxy HTTPS hacia `127.0.0.1:3001`. El puerto
   de JANVIER no se publica en todas las interfaces.
5. Verificar `https://tu-dominio/api/health`, inicio, contacto, admin y una
   invitación privada real de prueba.
6. En Mercado Pago registrar
   `https://tu-dominio/api/webhooks/mercado-pago`, ejecutar una compra con
   credenciales de prueba y sólo después activar credenciales reales.
7. Ejecutar `npm run notifications:test` dentro del contenedor de operaciones y
   confirmar recepción antes de cambiar `MAIL_ENABLED=true` definitivamente.

## Backup y observación

- Ejecutar diariamente `bash scripts/unix/production-backup.sh /ruta/segura`.
- Copiar los dumps y archivos de activos, documentos fiscales e imágenes procesadas a
  almacenamiento externo cifrado.
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
