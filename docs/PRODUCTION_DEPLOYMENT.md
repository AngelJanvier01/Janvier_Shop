# Despliegue de producción de JANVIER

Esta es la guía operativa principal para `https://jaanviieer.com`. No considera terminado
un despliegue hasta completar [POST_DEPLOY_VALIDATION.md](POST_DEPLOY_VALIDATION.md).

## Arquitectura y puertos

```text
Internet → Cloudflare HTTPS → Cloudflare Tunnel → 127.0.0.1:3001 → web
                                                               └→ red interna Compose
                                                                  ├→ PostgreSQL:5432
                                                                  ├→ background-removal:8080
                                                                  └→ workers
```

- `web` es el único servicio con `ports` y publica `127.0.0.1:3001`, nunca `0.0.0.0`.
- PostgreSQL, el motor de imágenes y los workers no publican puertos.
- No se abren 80, 443, 3001, 5432 ni 8080 en el firewall. El túnel es una conexión
  saliente.
- Los servicios permanentes usan `restart: unless-stopped` y health checks donde existe
  un endpoint útil.
- PostgreSQL, imágenes procesadas, propuestas, documentos fiscales y modelos se guardan
  en volúmenes con nombre. `docker compose down` conserva datos; `down --volumes` los
  elimina y sólo se usa dentro del procedimiento explícito de restauración.

## Datos y credenciales que debe proporcionar el operador

Nunca pegues valores reales en Git, tickets, documentación o comandos que queden en el
historial. Se guardan únicamente en `.env.production`, modo `600`.

Obligatorios para el primer despliegue:

| Variable o dato                  | Uso                                                        |
| -------------------------------- | ---------------------------------------------------------- |
| `POSTGRES_PASSWORD`              | Contraseña única de PostgreSQL.                            |
| `AUTH_SECRET`                    | Firma de sesiones, mínimo 32 bytes aleatorios.             |
| `INITIAL_ADMIN_EMAIL`            | Propietario inicial real.                                  |
| `INITIAL_ADMIN_PASSWORD`         | Contraseña inicial; cambiarla de forma controlada después. |
| `SICODD_USERNAME`                | Cuenta dedicada de lectura del proveedor.                  |
| `SICODD_ADMIN_PASSWORD`          | Contraseña de la cuenta SICODD.                            |
| `SICODD_PUBLIC_WAREHOUSES`       | Bodegas autorizadas para inventario público.               |
| Token de Cloudflare Tunnel       | Se instala en systemd; no pertenece al `.env`.             |
| Clave pública `age` y Deploy key | Respaldo cifrado al repositorio privado.                   |

Para habilitar pagos:

| Variable            | Uso                         |
| ------------------- | --------------------------- |
| `MP_PUBLIC_KEY`     | Clave pública de Checkout.  |
| `MP_ACCESS_TOKEN`   | Token privado del servidor. |
| `MP_WEBHOOK_SECRET` | Validación del webhook.     |

Para habilitar Gmail mediante contraseña de aplicación:

| Variable            | Valor esperado                                                     |
| ------------------- | ------------------------------------------------------------------ |
| `MAIL_ENABLED`      | `true`, sólo después de probar el envío.                           |
| `SMTP_USER`         | Cuenta real de Gmail o Google Workspace.                           |
| `SMTP_APP_PASSWORD` | Contraseña de aplicación, nunca la contraseña normal.              |
| `MAIL_FROM`         | Remitente visible autorizado.                                      |
| `MAIL_REPLY_TO`     | Dirección real de respuesta.                                       |
| `ALERT_RECIPIENTS`  | Destinatarios internos separados según la configuración existente. |

Opcionales hasta activar su integración: `GOOGLE_SITE_VERIFICATION`,
`BING_SITE_VERIFICATION`, `INDEXNOW_KEY`, `NEXT_PUBLIC_GOOGLE_ANALYTICS_ID`,
`NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID`, Google OAuth y el webhook transaccional de clientes.

## 1. Preparar Ubuntu

La guía presupone Ubuntu 24.04 LTS, un usuario operador llamado `janvier` y el repositorio
en `/srv/janvier/Janvier_Shop`.

```bash
sudo adduser --disabled-password --gecos '' janvier
sudo install -d -m 0750 -o janvier -g janvier /srv/janvier
sudo -u janvier git clone --branch NewV_3.0 --single-branch \
  https://github.com/AngelJanvier01/Janvier_Shop.git \
  /srv/janvier/Janvier_Shop
cd /srv/janvier/Janvier_Shop
sudo bash scripts/unix/provision-production-host.sh janvier
```

El script instala desde repositorios oficiales Docker Engine, Compose, `cloudflared`,
`age`, Git, `jq`, utilidades DNS y certificados CA. Cierra la sesión y vuelve a entrar para
aplicar la membresía del grupo `docker`, después verifica:

```bash
docker version
docker compose version
cloudflared --version
docker run --rm hello-world
```

No incluyas tokens en la URL de Git. Si el repositorio requiere autenticación, configura
una Deploy key de sólo lectura antes del `git clone`.

## 2. Crear el entorno de producción

```bash
cd /srv/janvier/Janvier_Shop
bash scripts/unix/generate-production-env.sh \
  jaanviieer.com \
  '<CORREO_ADMIN_REAL>'
chmod 600 .env.production
nano .env.production
```

El generador crea contraseñas aleatorias para PostgreSQL, sesiones y el administrador.
Completa manualmente SICODD, Mercado Pago y Gmail. Conserva exactamente:

```dotenv
NEXT_PUBLIC_SITE_URL="https://jaanviieer.com"
APP_URL="https://jaanviieer.com"
APP_PORT="3001"
SEARCH_INDEXING_DISABLED="false"
TRUST_PROXY_CLIENT_IP="true"
```

Valida sin imprimir secretos:

```bash
test "$(stat -c '%a' .env.production)" = '600'
docker compose --env-file .env.production -f compose.production.yaml config -q
git status --short --ignored | grep -F '!! .env.production'
```

## 3. DNS, reverse proxy y HTTPS

Cloudflare Tunnel actúa como reverse proxy. No instales Nginx o Caddy y no abras puertos
web en el servidor.

1. Mantén `jaanviieer.com` delegado a los nameservers de Cloudflare y conserva todos los
   registros MX, SPF, DKIM y DMARC existentes.
2. En **Cloudflare → Networking → Tunnels**, crea `janvier-produccion`.
3. Añade dos rutas publicadas, ambas hacia `http://127.0.0.1:3001`:
   `jaanviieer.com` y `www.jaanviieer.com`.
4. Instala el token sin guardarlo en el repositorio ni en el historial:

```bash
read -rsp 'Token de Cloudflare Tunnel: ' CF_TUNNEL_TOKEN; echo
sudo cloudflared service install "${CF_TUNNEL_TOKEN}"
unset CF_TUNNEL_TOKEN
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

5. En **SSL/TLS → Edge Certificates**, activa **Always Use HTTPS**.
6. En **Rules → Redirect Rules**, crea una redirección wildcard:
   - origen: `https://www.jaanviieer.com/*`
   - destino: `https://jaanviieer.com/${1}`
   - estado: `301`
   - conservar query string: sí.

Cloudflare recomienda hacer la redirección HTTP→HTTPS en el borde para evitar bucles.
Las rutas publicadas del túnel mapean un hostname público al servicio local sin abrir
puertos entrantes. Referencias: [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/),
[Always Use HTTPS](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/)
y [Single Redirects](https://developers.cloudflare.com/rules/url-forwarding/single-redirects/settings/).

Verifica DNS, conectividad del túnel y sockets locales:

```bash
dig +short NS jaanviieer.com
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
sudo ss -lntup
curl -sS -o /dev/null -D - http://jaanviieer.com/
curl -sS -o /dev/null -D - https://www.jaanviieer.com/prueba?x=1
```

El primer `curl` debe redirigir a HTTPS. El segundo debe conservar `/prueba?x=1` y
redirigir al dominio sin `www`.

## 4. Firewall

No ejecutes estas reglas hasta confirmar una segunda vía de acceso. Sustituye
`<IP_ADMIN>` y el puerto por el método real de administración. Para SSH:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow from '<IP_ADMIN>' to any port 22 proto tcp
sudo ufw enable
sudo ufw status verbose
```

Si el servidor sólo usa Escritorio Remoto, permite 3389 exclusivamente desde una IP fija
o VPN. Nunca agregues reglas públicas para 80, 443, 3001, 5432 u 8080.

## 5. Primer despliegue y migraciones

```bash
cd /srv/janvier/Janvier_Shop
git switch NewV_3.0
git pull --ff-only origin NewV_3.0
git rev-parse HEAD | tee /tmp/janvier-release-revision
docker compose --env-file .env.production -f compose.production.yaml config -q
bash scripts/unix/production-deploy.sh
```

`production-deploy.sh` valida permisos y variables, crea un respaldo previo, ejecuta
`prisma migrate deploy`, construye imágenes, espera los health checks y confirma que sólo
la web está ligada a loopback.

Comprueba servicios, migraciones, persistencia y puertos:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml \
  --profile maintenance run --rm migrate npm run prisma:deploy
docker compose --env-file .env.production -f compose.production.yaml \
  exec -T web wget -qO- http://127.0.0.1:3001/api/health
docker compose --env-file .env.production -f compose.production.yaml port web 3001
docker compose --env-file .env.production -f compose.production.yaml port database 5432 || true
docker volume ls --filter label=com.docker.compose.project=janvier-v2
```

La web debe mostrar `127.0.0.1:3001`; PostgreSQL no debe mostrar ningún binding.

## 6. Configurar correo y Mercado Pago

Con `MAIL_ENABLED=false`, completa los datos SMTP, vuelve a desplegar y prueba desde el
contenedor de operaciones:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile maintenance run --rm migrate npm run notifications:test
```

Sólo tras recibir y revisar ese correo cambia `MAIL_ENABLED=true` y vuelve a ejecutar
`production-deploy.sh`.

En Mercado Pago registra exactamente:

```text
https://jaanviieer.com/api/webhooks/mercado-pago
```

Primero usa credenciales de prueba. La validación P0 exige completar una compra controlada,
recibir el webhook firmado y confirmar el pedido en Admin. No imprimas tokens en los logs.

## 7. Scrapeo inicial

En `/admin/sincronizacion`:

1. Guarda la ruta interna del catálogo y deja la importación como borrador.
2. Ejecuta **Probar conexión SICODD**.
3. Ejecuta **Analizar todas las subcategorías**.

Después detén temporalmente el worker, encola una muestra de 35 artículos y ejecútala una
sola vez:

```bash
docker compose --env-file .env.production -f compose.production.yaml stop sicodd-sync-worker
docker compose --env-file .env.production -f compose.production.yaml \
  --profile maintenance run --rm migrate \
  npm run sicodd:queue-full -- --limit 35 --confirm
docker compose --env-file .env.production -f compose.production.yaml \
  --profile maintenance run --rm migrate npm run sicodd:worker:once
docker compose --env-file .env.production -f compose.production.yaml start sicodd-sync-worker
docker compose --env-file .env.production -f compose.production.yaml \
  logs --tail=200 sicodd-sync-worker image-worker
```

Revisa categorías, subcategorías, existencias por sucursal, imágenes y borradores en Admin.
Si la muestra es correcta, encola el barrido completo:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile maintenance run --rm migrate \
  npm run sicodd:queue-full -- --confirm
docker compose --env-file .env.production -f compose.production.yaml \
  logs --follow sicodd-sync-worker image-worker
```

Salir de `logs --follow` con `Ctrl+C` no detiene los workers.

## 8. Smoke test y E2E contra el dominio real

Smoke test después de cada despliegue:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm --no-deps e2e \
  node scripts/smoke/production-smoke.mjs
```

Recorrido público seguro de Playwright:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm e2e
```

Desde una estación con Node y Chromium también puede ejecutarse:

```bash
PLAYWRIGHT_BASE_URL=https://jaanviieer.com \
  npm run test:e2e:external
```

La suite completa contiene pruebas que crean y modifican datos. Sólo durante una ventana
controlada, con respaldo inmediato y sabiendo que tocará la base real:

```bash
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm \
  -e PRODUCTION_E2E_SCOPE=full \
  -e ALLOW_MUTATING_PRODUCTION_E2E=true \
  e2e bash -lc \
  'npm ci --no-audit --no-fund && npm run prisma:generate && npm run test:e2e:external'
```

No habilites las banderas `CATALOG_E2E`, `DIAGNOSTIC_E2E` o `PROJECT_ROOM_E2E` contra la
base real. Esos escenarios son para una base efímera aislada.

## 9. Respaldos

Configura el repositorio privado y el timer:

```bash
cd /srv/janvier/Janvier_Shop
sudo bash scripts/unix/configure-production-backup.sh \
  janvier \
  /srv/janvier/Janvier_Shop \
  git@github.com:AngelJanvier01/Janvier_Shop_Backups.git
```

Copia `JANVIER_BACKUP_RECOVERY_KEY.txt` fuera del servidor, registra la Deploy key de
escritura y elimina la copia local únicamente después de probar el descifrado. Luego:

```bash
sudo systemctl start janvier-backup.service
sudo systemctl enable --now janvier-backup.timer
sudo systemctl status janvier-backup.timer --no-pager
sudo journalctl -u janvier-backup.service -n 100 --no-pager
```

Un respaldo no está verificado por existir: debe completarse la restauración siguiente en
un host limpio.

## 10. Restauración real desde cero

En un Ubuntu limpio, completa los pasos 1 y 2, clona el repositorio privado de respaldos y
elige un snapshot:

```bash
sudo install -d -m 0700 -o janvier -g janvier /srv/janvier/restore
sudo -u janvier git clone \
  git@github.com:AngelJanvier01/Janvier_Shop_Backups.git \
  /srv/janvier/restore/backups
sudo -u janvier cp -a \
  /srv/janvier/restore/backups/snapshots/<FECHA_UTC> \
  /srv/janvier/restore/encrypted
cd /srv/janvier/restore/encrypted
sha256sum --check manifest.sha256
jq -r '.files[] | "\(.sha256)  \(.name)"' manifest.json | sha256sum --check -
```

Recompón las partes cifradas y descifra sin imprimir la clave:

```bash
install -d -m 0700 /srv/janvier/restore/plain
find /srv/janvier/restore/encrypted -maxdepth 1 -type f -name '*.age.part-*' \
  -printf '%f\n' | sed -E 's/\.part-[0-9]{4}$//' | sort -u | while read -r encrypted_name; do
  cat "/srv/janvier/restore/encrypted/${encrypted_name}".part-* \
    > "/srv/janvier/restore/${encrypted_name}"
  output="/srv/janvier/restore/plain/${encrypted_name%.age}"
  age --decrypt -i '<RUTA_SEGURA_A_LA_CLAVE_AGE>' \
    -o "${output}" "/srv/janvier/restore/${encrypted_name}"
  rm -f -- "/srv/janvier/restore/${encrypted_name}"
done
install -m 0600 /srv/janvier/restore/plain/environment.production \
  /srv/janvier/Janvier_Shop/.env.production
```

La siguiente orden elimina únicamente los volúmenes del proyecto Compose actual y los
reconstruye desde el snapshot. Requiere una confirmación literal:

```bash
cd /srv/janvier/Janvier_Shop
bash scripts/unix/production-restore.sh \
  /srv/janvier/restore/plain \
  --confirm-destroy-existing-data
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm --no-deps e2e \
  node scripts/smoke/production-smoke.mjs
```

Comprueba además login, recuentos de productos/pedidos, una propuesta privada, documentos
y varias imágenes. Registra fecha, snapshot, revisión de código, duración y resultado en
`POST_DEPLOY_VALIDATION.md`. Sólo entonces el backup queda verificado.

## 11. Rollback

Antes de cada despliegue registra la revisión anterior y crea un respaldo completo:

```bash
cd /srv/janvier/Janvier_Shop
git rev-parse HEAD | tee /tmp/janvier-previous-revision
bash scripts/unix/production-backup.sh /srv/janvier/rollback-snapshot
```

Si no hubo migraciones incompatibles ni cambios de datos, vuelve al código anterior:

```bash
PREVIOUS_REVISION="$(cat /tmp/janvier-previous-revision)"
git switch --detach "${PREVIOUS_REVISION}"
bash scripts/unix/production-deploy.sh
docker compose --env-file .env.production -f compose.production.yaml \
  --profile validation run --rm --no-deps e2e \
  node scripts/smoke/production-smoke.mjs
```

Si hubo migración o escritura incompatible, el rollback correcto es restaurar el snapshot
previo completo:

```bash
bash scripts/unix/production-restore.sh \
  /srv/janvier/rollback-snapshot \
  --confirm-destroy-existing-data
```

Después de estabilizar, vuelve a la rama únicamente cuando exista una corrección revisada:

```bash
git switch NewV_3.0
git pull --ff-only origin NewV_3.0
```
