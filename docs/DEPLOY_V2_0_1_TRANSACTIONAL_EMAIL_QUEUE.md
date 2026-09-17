# Runbook: despliegue V2.0.1 con cola de correo transaccional

## 1. Identificacion

| Campo              | Valor                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| Proyecto           | JANVIER                                                                                            |
| Rama de referencia | v2.0.1                                                                                             |
| APPLICATION_COMMIT | a5f1eac                                                                                            |
| Titulo esperado    | feat(notifications): add transactional email queue                                                 |
| Ruta esperada      | /opt/janvier-shop                                                                                  |
| Compose            | compose.production.yaml                                                                            |
| Fecha del runbook  | 2026-08-04                                                                                         |
| RUNBOOK_COMMIT     | Registrar en el informe el SHA del commit documental si existe; no cambia el commit de aplicacion. |

Proposito: desplegar exactamente a5f1eac de forma verificable y reversible,
manteniendo MAIL_ENABLED=false. Incluye migracion de EmailOutbox, worker,
plantillas, Message-ID estable, pagina de seguridad y observabilidad.

Excluye expresamente conexion Gmail, credenciales SMTP reales, OAuth, envio de
pruebas reales, instalacion o activacion de timers y cualquier v2.0.2.

## 2. Reglas de ejecucion

Usar set -Eeuo pipefail. El agente debe detenerse ante cualquier error; no usar
git reset --hard, no borrar volumenes, no ejecutar docker compose down -v, no
sobrescribir o imprimir .env.production, no modificar DNS/Cloudflare/Tunnel/Nginx,
no habilitar MAIL_ENABLED, no instalar timers, no cambiar codigo, crear commits ni
hacer push desde produccion.

Pedir confirmacion humana antes de la migracion y antes de reemplazar
contenedores. Si falla healthcheck, ejecutar rollback de aplicacion.

## 3. Prerrequisitos

```bash
set -Eeuo pipefail
cd /opt/janvier-shop
whoami
hostname
date --iso-8601=seconds
uname -a
df -h
free -h
git --version
docker version
docker compose version
systemctl is-active docker
test -r /opt/janvier-shop && test -w /opt/janvier-shop
git ls-remote --exit-code origin refs/heads/v2.0.1 >/dev/null
pgrep -af 'production-deploy|production-backup|docker compose.*migrate' || true
```

Si aparece mantenimiento activo, detenerse. Comprobar el dominio sin mostrar el
resto de configuracion:

```bash
SITE_URL="$(awk -F= '/^NEXT_PUBLIC_SITE_URL=/{gsub(/^[[:space:]"]+|[[:space:]"]+$/, "", $2); print $2; exit}' .env.production)"
test -n "$SITE_URL"
curl -fsSI --max-time 20 "$SITE_URL" >/dev/null
```

## 4. Estado previo

```bash
set -Eeuo pipefail
cd /opt/janvier-shop
git status --short
git branch --show-current
git rev-parse HEAD
git remote -v
docker compose --env-file .env.production -f compose.production.yaml ps
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
PREVIOUS_SHA="$(git rev-parse HEAD)"
printf '%s\n' "$PREVIOUS_SHA"
```

Si git status --short no esta vacio, mostrar la lista de archivos, detenerse y no
descartarlos. Si el SHA no coincide con la produccion documentada, informarlo sin
asumir su procedencia.

## 5. Respaldo previo y validacion

Inspeccionar primero los mecanismos reales:

```bash
sed -n '1,220p' compose.production.yaml
sed -n '1,220p' scripts/unix/production-backup.sh
test -f docs/PRODUCTION_BACKUP_TO_GIT.md && sed -n '1,180p' docs/PRODUCTION_BACKUP_TO_GIT.md
```

Confirmar que Compose contiene database, migrate y web. El script existente usa
pg_dump -Fc dentro de database y respalda activos privados; no inventar una URL
externa de PostgreSQL.

```bash
set -Eeuo pipefail
umask 077
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="/opt/janvier-backups/v2.0.1-$STAMP"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
docker compose --env-file .env.production -f compose.production.yaml config --services | grep -Fx database
docker compose --env-file .env.production -f compose.production.yaml ps > "$BACKUP_DIR/compose-ps.txt"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > "$BACKUP_DIR/containers.txt"
docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' > "$BACKUP_DIR/images.txt"
git rev-parse HEAD > "$BACKUP_DIR/repository-sha.txt"
bash scripts/unix/production-backup.sh "$BACKUP_DIR"
install -m 600 .env.production "$BACKUP_DIR/environment.production.rollback"
DUMP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f -print -quit)"
test -n "$DUMP_FILE"
pg_restore --list "$DUMP_FILE" >/dev/null
(cd "$BACKUP_DIR" && sha256sum * > SHA256SUMS)
printf 'application_commit=%s\nbackup_utc=%s\ndatabase_dump=%s\nconfiguration_copy=environment.production.rollback(mode=600)\n' \
  "$(git rev-parse HEAD)" "$(date -u --iso-8601=seconds)" "$(basename "$DUMP_FILE")" > "$BACKUP_DIR/manifest.txt"
chmod 600 "$BACKUP_DIR"/*
```

El directorio tiene umask 077; no mover su copia protegida de configuracion a una
ubicacion world-readable.

## 6. Verificacion segura de configuracion

Nunca usar source .env.production ni imprimirlo.

```bash
set -Eeuo pipefail
test -f .env.production
git check-ignore -q .env.production
MODE="$(stat -c '%a' .env.production)"
(( (8#$MODE & 077) == 0 ))
MAIL_ENABLED_VALUE="$(awk -F= '/^MAIL_ENABLED=/{gsub(/^[[:space:]"]+|[[:space:]"]+$/, "", $2); print $2; exit}' .env.production)"
test "$MAIL_ENABLED_VALUE" = false
for key in POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB AUTH_SECRET NEXT_PUBLIC_SITE_URL APP_PORT; do
  grep -q "^$key=" .env.production
done
printf 'MAIL_ENABLED=false\n'
```

Si falta una variable o MAIL_ENABLED no es exactamente false, detenerse y pedir
intervencion humana. Nunca revelar SMTP_PASSWORD, app password, AUTH_SECRET,
DATABASE_URL completa, cookies, tokens ni claves privadas.

## 7. Obtencion del commit objetivo

```bash
set -Eeuo pipefail
git fetch --prune origin
git show --no-patch --oneline a5f1eac
git branch -a --contains a5f1eac
git switch v2.0.1
git merge --ff-only origin/v2.0.1
git status --short
```

La aplicacion objetivo siempre es a5f1eac. Si origin/v2.0.1 esta despues por un
commit documental, detenerse y pedir confirmacion humana. Solo tras confirmar que
los commits posteriores son documentacion, fijar el checkout de aplicacion:

```bash
git switch --detach a5f1eac
test "$(git rev-parse HEAD)" = a5f1eac
git status --short
```

Si el SHA no coincide, no desplegar otra revision.

## 8. Inspeccion previa al build

```bash
set -Eeuo pipefail
sed -n '1,260p' compose.production.yaml
sed -n '1,220p' Dockerfile
node -e "const p=require('./package.json'); for (const k of ['db:bootstrap','prisma:deploy','notifications:status','notifications:preview','notifications:prune','notifications:daily-report','notifications:dispatch','notifications:test']) console.log(k+'='+p.scripts[k])"
sed -n '1,260p' docs/GMAIL_TRANSACTIONAL_EMAIL.md
sed -n '1,220p' docs/JAN-TECH-015_SYSTEMD_NOTIFICATION_RUNNER.md
```

Confirmar que web y migrate reciben MAIL_ENABLED y que con false no depende Gmail
para arrancar. El comando notifications:test queda prohibido durante este runbook.

## 9. Build

Registrar imagenes previas para rollback; no eliminarlas.

```bash
set -Eeuo pipefail
mkdir -p deployment-reports
BUILD_START="$(date -u --iso-8601=seconds)"
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' | grep -E 'janvier.*(web|migrate)' || true
docker compose --env-file .env.production -f compose.production.yaml config -q
docker compose --env-file .env.production -f compose.production.yaml build web migrate
BUILD_END="$(date -u --iso-8601=seconds)"
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' | grep -E 'janvier.*(web|migrate)'
printf 'build_start=%s\nbuild_end=%s\n' "$BUILD_START" "$BUILD_END"
```

Registrar duracion, imagenes, tamanos y warnings. Un fallo detiene el proceso y
conserva contenedores e imagenes anteriores.

## 10. Migracion: pausa humana obligatoria

**CONFIRMACION HUMANA REQUERIDA:** el backup esta creado y validado, el build
termino y MAIL_ENABLED sigue en false. Preguntar: "Autorizar ejecucion de
migraciones de a5f1eac?" No ejecutar sin autorizacion explicita.

```bash
set -Eeuo pipefail
docker compose --env-file .env.production -f compose.production.yaml --profile maintenance run --rm migrate
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run prisma:deploy
```

Comprobar la migracion y estructuras sin consultar payloads de correo:

```bash
set -Eeuo pipefail
docker compose --env-file .env.production -f compose.production.yaml exec -T database sh -c '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "
    SELECT 1 FROM \"_prisma_migrations\" WHERE migration_name = '\''20260804160000_harden_email_outbox'\'';
    SELECT to_regclass('\''public.EmailOutbox'\'');
    SELECT to_regclass('\''public.AdminAuditEvent'\'');
    SELECT indexname FROM pg_indexes WHERE tablename = '\''EmailOutbox'\'' ORDER BY indexname;"'
```

Esperar la marca de migracion, ambas tablas e indices EmailOutbox. Si falta algo,
no reemplazar contenedores.

## 11. Reemplazo de servicios: pausa humana obligatoria

**CONFIRMACION HUMANA REQUERIDA:** preguntar: "Migracion validada y backup
disponible. Autorizar reemplazar el contenedor web?" Sin confirmacion, detenerse.

```bash
set -Eeuo pipefail
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d web
docker compose --env-file .env.production -f compose.production.yaml ps
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

No usar --remove-orphans sin revisar primero servicios ajenos intencionales.

## 12. Healthchecks y funcion minima

Detectar el puerto real, comprobar salud interna, respuesta local, raiz, www,
rutas publicas y login sin autenticarse. Aceptar 200 o redireccion 301/302/307/308;
rechazar 500, 502 persistente, 503, timeout o unhealthy.

```bash
set -Eeuo pipefail
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health
LOCAL_BIND="$(docker compose --env-file .env.production -f compose.production.yaml port web 3001)"
curl -fsSI --max-time 15 "http://$LOCAL_BIND"
SITE_URL="$(awk -F= '/^NEXT_PUBLIC_SITE_URL=/{gsub(/^[[:space:]"]+|[[:space:]"]+$/, "", $2); print $2; exit}' .env.production)"
SITE_HOST="$(printf '%s' "$SITE_URL" | sed -E 's#^https?://##; s#/.*$##')"
SITE_ROOT="$(printf '%s' "$SITE_URL" | sed 's#/$##')"
WWW_HOST="$(printf '%s' "$SITE_HOST" | sed 's/^www\.//')"
curl -fsSI --max-time 20 "$SITE_ROOT"
curl -fsSI --max-time 20 "https://www.$WWW_HOST"
curl -fsSI --max-time 20 "$SITE_ROOT/admin/acceso"
for path in / /contacto /diagnostico /proyectos /suministro/catalogo; do
  curl -fsSI --max-time 20 "$SITE_ROOT$path" >/dev/null
done
```

Validar Project Room con una URL autorizada ya existente sin imprimir ni guardar
su token. No crear propuestas, decisiones ni formularios reales.

## 13. Cola con correo apagado

No ejecutar notifications:test ni usar --apply.

```bash
set -Eeuo pipefail
test "$MAIL_ENABLED_VALUE" = false
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:status
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:preview -- --output=/tmp/janvier-email-preview.json
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:prune
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:daily-report
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:dispatch
```

Registrar PENDING, PROCESSING, RETRY, SENT y DEAD. Dispatch debe informar cero
envios; no debe abrir SMTP ni modificar eventos comerciales.

## 14. Logs y ausencia de SMTP

Guardar logs restringidos y registrar conteos, no lineas que puedan contener
secretos.

```bash
set -Eeuo pipefail
umask 077
LOG_FILE="$BACKUP_DIR/compose-post-deploy.log"
docker compose --env-file .env.production -f compose.production.yaml logs --since=10m --tail=300 > "$LOG_FILE"
for pattern in 'error|fatal|panic|migration|unhandled|rejection|database'; do
  printf '%s=%s\n' "$pattern" "$(grep -Eic "$pattern" "$LOG_FILE" || true)"
done
printf 'smtp_connection_attempts=%s\n' "$(grep -Eic 'connected.*smtp|smtp.*connect|gmail.*connect' "$LOG_FILE" || true)"
```

Confirmar smtp_connection_attempts=0. Investigar errores sin copiar secretos al
informe.

## 15. Verificacion systemd sin instalar

```bash
set -Eeuo pipefail
systemd-analyze verify \
  scripts/systemd/janvier-email-dispatch.service \
  scripts/systemd/janvier-email-dispatch.timer \
  scripts/systemd/janvier-daily-report.service \
  scripts/systemd/janvier-daily-report.timer
```

No copiar unidades a /etc/systemd/system, ni ejecutar daemon-reload, enable o
start. Registrar warnings. JAN-TECH-015 sigue aceptada temporalmente: el usuario
runner requiere grupo Docker, no se usa para SSH humano ni recibe claves
adicionales; el socket Docker no se expone a web y se retirara al migrar scheduler
a servicios Compose dedicados.

## 16. Criterios de exito

Solo hay exito si HEAD=a5f1eac, repositorio limpio, backup validado, migracion
20260804160000_harden_email_outbox aplicada, contenedores healthy, dominio/rutas
responden, MAIL_ENABLED=false, no hubo SMTP, cola es legible, logs no tienen
errores criticos, activos privados siguen intactos, Project Room no presenta
regresion visible y rollback esta disponible.

## 17. Rollback

### Aplicacion

Si falla healthcheck, conservar la migracion compatible y volver al SHA previo sin
reescribir historia:

```bash
set -Eeuo pipefail
git switch --detach "$PREVIOUS_SHA"
docker compose --env-file .env.production -f compose.production.yaml build web
docker compose --env-file .env.production -f compose.production.yaml up --no-build -d web
docker compose --env-file .env.production -f compose.production.yaml exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health
```

### Datos

No restaurar automaticamente. Solo si hay dano/incompatibilidad, detener
escrituras, pedir autorizacion humana explicita, restaurar el dump validado de
BACKUP_DIR, verificar integridad y levantar primero la aplicacion previa.

## 18. Informe final y pendientes

Crear /opt/janvier-shop/deployment-reports/DEPLOY_V2_0_1_YYYYMMDD_HHMMSS.md sin
secretos. Debe incluir hostname, usuario, fecha, SHA anterior/nuevo,
APPLICATION_COMMIT, RUNBOOK_COMMIT si aplica, backup/checksum, build, migraciones,
contenedores, healthchecks, cola, systemd verify, warnings, errores, rollback y
resultado. Dejar sin ejecutar: Gmail, SMTP, correo real, timers y v2.0.2.

## 19. Validacion del Markdown

```bash
set -Eeuo pipefail
test -f docs/GMAIL_TRANSACTIONAL_EMAIL.md
test -f docs/JAN-TECH-015_SYSTEMD_NOTIFICATION_RUNNER.md
test -f scripts/unix/production-backup.sh
test -f scripts/systemd/janvier-email-dispatch.service
node -e "const p=require('./package.json'); for (const k of ['notifications:status','notifications:preview','notifications:prune','notifications:daily-report','notifications:dispatch']) if (!p.scripts[k]) process.exit(1)"
docker compose --env-file .env.production.example -f compose.production.yaml config -q
git diff --check
```

No hacer commit ni push desde produccion.
