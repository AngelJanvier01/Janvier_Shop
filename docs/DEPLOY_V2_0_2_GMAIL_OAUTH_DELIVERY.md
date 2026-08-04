# Runbook: JANVIER v2.0.2 con Gmail OAuth desactivado

## Identificación

| Campo            | Valor                                         |
| ---------------- | --------------------------------------------- |
| Proyecto         | JANVIER                                       |
| Rama             | `v2.0.2`                                      |
| Commit funcional | `3232d4d736da17072d9905fe8ca22f1e0a308f67`    |
| Título           | `feat(settings): add Gmail OAuth delivery`    |
| Checkout         | `/home/janvier/Documents/GitHub/Janvier_Shop` |
| Backups          | `/home/janvier/backups/Janvier_Shop`          |
| Compose          | `compose.production.yaml`                     |
| Fecha            | 2026-08-04                                    |

Incluye panel Correo y notificaciones, OAuth Gmail, vault AES-GCM, modelos Prisma, proveedores Gmail API/SMTP heredado/desactivado, rutas, pruebas y documentación. Excluye credenciales o autorización Google reales, `MAIL_ENABLED=true`, envíos, timers, workers periódicos y cambios de Cloudflare, Nginx, Tunnel o DNS.

## Reglas absolutas

Usar `set -Eeuo pipefail` y detenerse ante un error. No usar `git reset --hard`, force push, `docker compose down -v`, `docker system prune`, ni borrar volúmenes/recrear PostgreSQL. No imprimir secretos ni modificar `.env.production` sin autorización.

No habilitar correo, conectar Google, instalar timers, ni ejecutar `notifications:test`, `notifications:dispatch` o `notifications:daily-report`. Pedir confirmación humana separada antes de migrar, reemplazar web, modificar `.env.production` o hacer rollback.

## Estado inicial

```bash
set -Eeuo pipefail
cd /home/janvier/Documents/GitHub/Janvier_Shop
whoami; hostname; date --iso-8601=seconds; uname -a; df -h; free -h
git branch --show-current; git rev-parse HEAD; git status --short; git remote -v; git log --oneline -5
docker version; docker compose version; systemctl is-active docker
docker compose --env-file .env.production -f compose.production.yaml ps
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
```

Si Git está sucio, detenerse sin descartar nada. Registrar `PREVIOUS_SHA="$(git rev-parse HEAD)"`; se espera inicialmente `release-v2.0.1` / `3f8c9c83309ed79d132962b8db1788e51fc31fa0`, pero comprobarlo.

## Actualización Git

```bash
set -Eeuo pipefail
git fetch --prune origin
git checkout v2.0.2
git merge --ff-only origin/v2.0.2
git rev-parse HEAD
git status --short
git merge-base --is-ancestor 3232d4d736da17072d9905fe8ca22f1e0a308f67 HEAD
```

El commit funcional debe ser ancestro de `HEAD`. Si existe un commit documental posterior, registrar `APPLICATION_COMMIT=3232d4d736da17072d9905fe8ca22f1e0a308f67` y `RUNBOOK_COMMIT=$(git rev-parse HEAD)`; no desplegar cambios funcionales posteriores sin autorización.

## Backup previo y rollback verificable

```bash
set -Eeuo pipefail
umask 077
STAMP="$(date -u +%Y%m%d-%H%M%S)"
BACKUP_DIR="/home/janvier/backups/Janvier_Shop/v2.0.2-$STAMP"
mkdir -p "$BACKUP_DIR"; chmod 700 "$BACKUP_DIR"
COMPOSE=(docker compose --env-file .env.production -f compose.production.yaml)
"${COMPOSE[@]}" ps > "$BACKUP_DIR/compose-ps.txt"
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > "$BACKUP_DIR/containers.txt"
docker image ls --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.Size}}' > "$BACKUP_DIR/images.txt"
git rev-parse HEAD > "$BACKUP_DIR/repository-sha.txt"
bash scripts/unix/production-backup.sh "$BACKUP_DIR"
install -m 600 .env.production "$BACKUP_DIR/environment.production.rollback"
DUMP_FILE="$(find "$BACKUP_DIR" -maxdepth 1 -name '*.dump' -type f -print -quit)"
test -n "$DUMP_FILE"
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore --list "$DUMP_FILE" >/dev/null
else
  docker run --rm --network none --read-only \
    --mount "type=bind,src=$DUMP_FILE,dst=/backup.dump,readonly" \
    postgres:16-alpine pg_restore --list /backup.dump >/dev/null
fi
command -v sort xargs sha256sum >/dev/null
sort --help | grep -q -- '--zero-terminated'
xargs --help | grep -q -- '--null'
(
  cd "$BACKUP_DIR"
  find . -type f ! -path './SHA256SUMS' -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)
FOREIGN_COUNT="$(
  find "$BACKUP_DIR" \
    \( ! -user janvier -o ! -group janvier \) \
    -printf . | wc -c
)"
if [ "$FOREIGN_COUNT" -gt 0 ]; then
  printf 'Objetos con propietario inesperado: %s\n' "$FOREIGN_COUNT"
  find "$BACKUP_DIR" \( ! -user janvier -o ! -group janvier \) -print
  if ! sudo -n true >/dev/null 2>&1; then
    printf '%s\n' 'Se requiere autorización humana para corregir propietarios con sudo.' >&2
    exit 1
  fi
  sudo -n chown -R janvier:janvier "$BACKUP_DIR"
fi
test -z "$(find "$BACKUP_DIR" \( ! -user janvier -o ! -group janvier \) -print -quit)"
find "$BACKUP_DIR" -type d -exec chmod 700 {} +
find "$BACKUP_DIR" -type f -exec chmod 600 {} +
test -z "$(find "$BACKUP_DIR" -type d ! -perm 700 -print -quit)"
test -z "$(find "$BACKUP_DIR" -type f ! -perm 600 -print -quit)"
WEB_CID="$("${COMPOSE[@]}" ps -q web)"; test -n "$WEB_CID"
ACTIVE_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$WEB_CID")"
docker image inspect "$ACTIVE_IMAGE_ID" >/dev/null
docker tag "$ACTIVE_IMAGE_ID" janvier-v2-web:rollback-pre-v2.0.2
docker image inspect janvier-v2-web:rollback-pre-v2.0.2 >/dev/null
```

`pg_restore` valida el dump antes de cualquier despliegue. `SHA256SUMS` se genera sólo con archivos regulares y se excluye a sí mismo. Herramientas Docker pueden crear objetos `root` aun cuando el runner sea `janvier`; por eso se inspeccionan propietarios reales y se muestran únicamente cantidad y rutas. Si hace falta `sudo` con contraseña o no está autorizado, detenerse y pedir autorización humana: nunca intentar elevar privilegios de forma interactiva o silenciosa. Tras corregir, se comprueba que todos los directorios y archivos pertenezcan a `janvier:janvier`; los directorios quedan `700` y los archivos `600`.

No usar `docker commit`. La imagen activa sólo se etiqueta para rollback después de que `docker image inspect` confirma que existe e inspeccionable. Si falta imagen activa, detenerse; reconstruir sólo desde el SHA desplegado y verificar standalone, activos y Prisma Client antes de etiquetarla.

## Entorno con entrega apagada

Nunca hacer `source .env.production` ni imprimirlo.

```bash
set -Eeuo pipefail
test -f .env.production; git check-ignore -q .env.production
MODE="$(stat -c '%a' .env.production)"; (( (8#$MODE & 077) == 0 ))
node <<'NODE'
const fs = require('node:fs');
const lines = fs.readFileSync('.env.production', 'utf8').split(/\r?\n/u);
const definitions = [];
for (const line of lines) {
  if (!/^\s*(?:export\s+)?MAIL_ENABLED\s*=/u.test(line)) continue;
  const match = line.match(/^\s*(?:export\s+)?MAIL_ENABLED\s*=\s*(?:(["'])(.*?)\1|([^\s#]+))\s*(?:#.*)?$/u);
  if (!match) process.exitCode = 1;
  else definitions.push((match[2] ?? match[3]).toLowerCase());
}
if (definitions.length !== 1 || definitions[0] !== 'false' || process.exitCode) process.exit(1);
console.log('MAIL_ENABLED=false');
NODE
for key in AUTH_SECRET NEXT_PUBLIC_SITE_URL APP_URL JANVIER_TIMEZONE; do grep -q "^$key=" .env.production; done
```

`DATABASE_URL` o `POSTGRES_*` debe existir sin revelarlo. Las variables OAuth pueden faltar: Client ID, Client Secret, Redirect URI, Encryption Key, account/domain y publishing status. Esa ausencia debe mostrar bootstrap faltante y bloquear conexión, nunca impedir web.

## Build

```bash
set -Eeuo pipefail
BUILD_START="$(date -u --iso-8601=seconds)"
"${COMPOSE[@]}" config -q
"${COMPOSE[@]}" build
BUILD_END="$(date -u --iso-8601=seconds)"
"${COMPOSE[@]}" images
NEW_WEB_IMAGE_ID="$("${COMPOSE[@]}" images -q web)"
NEW_MIGRATE_IMAGE_ID="$("${COMPOSE[@]}" images -q migrate)"
test -n "$NEW_WEB_IMAGE_ID"; test -n "$NEW_MIGRATE_IMAGE_ID"
docker tag "$NEW_WEB_IMAGE_ID" janvier-v2-web:v2.0.2-3232d4d
docker tag "$NEW_MIGRATE_IMAGE_ID" janvier-v2-migrate:v2.0.2-3232d4d
printf 'build_start=%s\nbuild_end=%s\nweb=%s\nmigrate=%s\n' "$BUILD_START" "$BUILD_END" "$NEW_WEB_IMAGE_ID" "$NEW_MIGRATE_IMAGE_ID"
```

Registrar duración, IDs, tamaños y warnings; no reemplazar contenedores durante build.

## Migración: pausa humana obligatoria

Pedir: **“Autorizo únicamente la ejecución de migraciones de v2.0.2. No autorizo todavía reemplazar el contenedor web.”**

El comando por defecto de `migrate` es `npm run db:bootstrap`; no ejecutarlo porque puede hacer seed. Ejecutar únicamente el deploy Prisma:

```bash
set -Eeuo pipefail
"${COMPOSE[@]}" --profile maintenance run --rm migrate npm run prisma:deploy
"${COMPOSE[@]}" --profile maintenance run --rm migrate npm run prisma:deploy
```

No usar reset, `db push`, `migrate dev` ni SQL destructivo. Deben estar `20260804170000_gmail_oauth_delivery_foundation` y `20260804180000_harden_google_oauth_state_and_delivery`.

```bash
"${COMPOSE[@]}" exec -T database sh -c '
  psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "
    SELECT migration_name
    FROM \"_prisma_migrations\"
    WHERE migration_name IN (
      \$\$20260804170000_gmail_oauth_delivery_foundation\$\$,
      \$\$20260804180000_harden_google_oauth_state_and_delivery\$\$
    );
    SELECT to_regclass(\$\$public.EmailOutbox\$\$),
           to_regclass(\$\$public.NotificationDeliveryConfiguration\$\$),
           to_regclass(\$\$public.GoogleOAuthAuthorizationAttempt\$\$);
    SELECT count(*) FILTER (WHERE \"encryptedRefreshToken\" IS NOT NULL) AS refresh_tokens,
           count(*) FILTER (WHERE \"deliveryEnabled\") AS delivery_enabled,
           count(*) FILTER (WHERE \"providerStatus\" = \$\$CONNECTED\$\$) AS connected_providers
    FROM \"NotificationDeliveryConfiguration\";
    SELECT count(*) AS active_oauth_attempts
    FROM \"GoogleOAuthAuthorizationAttempt\"
    WHERE \"consumedAt\" IS NULL AND \"expiresAt\" > NOW();
  "
'
```

En este despliegue inicial se esperan ambas migraciones OAuth aplicadas y `EmailOutbox` intacta. Los cuatro contadores de estado deben ser exactamente `0`: `refresh_tokens`, `delivery_enabled`, `connected_providers` y `active_oauth_attempts`. En particular, debe haber cero configuraciones con refresh token, `deliveryEnabled=true` o `providerStatus=CONNECTED`, y cero intentos OAuth activos inesperados. La migración de hardening conserva intentos anteriores como auditoría invalidada.

Si falta una migración, `EmailOutbox` no existe o cualquiera de esos contadores es distinto de cero, detener el runbook: no reemplazar `web`, no borrar datos y no desconectar proveedores automáticamente. Solicitar revisión humana. La consulta sólo devuelve nombres de migración, nombres de relaciones y contadores; no imprimir correos, tokens ni ciphertext.

## Reemplazo, healthcheck y verificación funcional

Antes, confirmar web antigua healthy, raíz/www y logs Prisma. Pedir: **“Autorizo únicamente el reemplazo del servicio web por v2.0.2. No autorizo correo ni timers.”**

```bash
set -Eeuo pipefail
"${COMPOSE[@]}" up -d --no-deps --no-build web
for _ in $(seq 1 36); do
  STATUS="$("${COMPOSE[@]}" ps --format json web | tr -d '\n')"
  printf '%s\n' "$STATUS"
  printf '%s' "$STATUS" | grep -q healthy && break
  sleep 5
done
"${COMPOSE[@]}" exec -T web wget -q -O - http://127.0.0.1:3001/api/health
curl -fsSI --max-time 20 https://jaanviieer.com/
curl -fsSI --max-time 20 https://www.jaanviieer.com/
curl -fsSI --max-time 20 https://jaanviieer.com/admin
curl -fsSI --max-time 20 https://jaanviieer.com/admin/ajustes/correo
```

Admin puede redirigir a login. `/admin/ajustes` no es ruta propia; validar `/admin/ajustes/correo`. Usar `--force-recreate` sólo si Compose mantiene imagen vieja y `latest` se verificó. Nunca tocar database.

Con sesión humana, revisar bootstrap FALTANTE, conectar bloqueado, cuenta enmascarada, scopes, `SERVER DISABLED` y ausencia de secretos. No iniciar OAuth. TEST debe quedar bloqueado y preview no debe contactar Gmail.

## Cola, logs, systemd, rollback e informe

```bash
set -Eeuo pipefail
"${COMPOSE[@]}" --profile maintenance run --rm migrate npm run notifications:status
"${COMPOSE[@]}" --profile maintenance run --rm migrate npm run notifications:preview
"${COMPOSE[@]}" logs --since=10m --tail=300 > "$BACKUP_DIR/compose-post-deploy.log"
systemd-analyze verify scripts/systemd/janvier-email-dispatch.service scripts/systemd/janvier-email-dispatch.timer scripts/systemd/janvier-daily-report.service scripts/systemd/janvier-daily-report.timer
```

No ejecutar dispatch, test, daily-report ni prune. Registrar PENDING/PROCESSING/RETRY/SENT/DEAD, cero contactos Google/SMTP/envíos y warnings saneados. No instalar unidades; JAN-TECH-015 sigue aceptada y el socket Docker nunca se expone a web.

Crear `$BACKUP_DIR/DEPLOY_V2_0_2_FINAL_REPORT.md` sin secretos: SHAs, commits, backup/checksums, imágenes, migraciones, healthchecks, bootstrap/OAuth, cola, kill switch, logs, warnings y rollback.

Si healthcheck falla, pedir confirmación y ejecutar sólo:

```bash
docker tag janvier-v2-web:rollback-pre-v2.0.2 janvier-v2-web:latest
"${COMPOSE[@]}" up -d --no-deps --no-build --force-recreate web
"${COMPOSE[@]}" exec -T web wget -q -O /dev/null http://127.0.0.1:3001/api/health
```

No restaurar datos automáticamente. Éxito sólo con Git limpio, backup/rollback válidos, migraciones aplicadas, healthy, bootstrap faltante seguro, `MAIL_ENABLED=false`, `deliveryEnabled=false`, sin proveedor conectado, refresh token, SMTP, Google API, correo ni timers.

Punto final: **JANVIER v2.0.2 fue desplegada con Gmail OAuth desactivado. MAIL_ENABLED permanece en false, no existe proveedor conectado, los timers no fueron instalados y no se enviaron correos.**
