# Despliegue en Ubuntu con GoDaddy y Cloudflare Tunnel

Esta guía publica JANVIER V2 sin abrir HTTP/HTTPS en el servidor. El dominio
sigue registrado en GoDaddy; solamente se delega su DNS a Cloudflare. El túnel
sale desde Ubuntu hacia Cloudflare y enruta `https://tu-dominio` a
`http://127.0.0.1:3001`, donde ya escucha el contenedor web de producción.

## Arquitectura

```text
Visitante → Cloudflare (HTTPS) → Cloudflare Tunnel → Ubuntu:127.0.0.1:3001 → JANVIER V2
```

No se necesitan puertos entrantes 80/443. El servidor conserva acceso SSH para
administración y necesita salida HTTPS hacia Cloudflare, GitHub y Docker Hub.

## 1. Preparar el dominio en Cloudflare

1. Crea una cuenta de Cloudflare y agrega `tu-dominio.com` con el plan gratuito
   disponible.
2. Cloudflare mostrará dos *nameservers*.
3. En GoDaddy: **Mis productos → Dominio → DNS → Nameservers → Cambiar**.
   Selecciona nombres de servidor personalizados y pega los dos de Cloudflare.
   No es necesario transferir ni renovar el dominio con Cloudflare.
4. Antes de cambiar los nameservers, copia a Cloudflare todos los registros que
   ya uses: MX, TXT/SPF, DKIM, verificaciones y subdominios. No borres el correo
   existente por accidente.
5. Espera a que la zona figure como **Active** en Cloudflare. La propagación
   puede tardar desde minutos hasta 24 horas.

Usa Cloudflare como DNS autoritativo. Mantener DNS sólo en GoDaddy obliga a
configurar CNAME manuales y el dominio raíz (`tu-dominio.com`) no suele admitir
CNAME en GoDaddy; es más frágil para Cloudflare Tunnel.

## 2. Preparar Ubuntu y desplegar JANVIER

Reemplaza `/srv/janvier/Janvier_Shop` por la ruta real del repositorio y
`tu-dominio.com` por tu dominio.

```bash
sudo apt update
sudo apt install -y ca-certificates curl git

sudo mkdir -p /srv/janvier
sudo chown "$USER":"$USER" /srv/janvier
cd /srv/janvier
git clone --branch NewV_2.0 https://github.com/AngelJanvier01/Janvier_Shop.git
cd Janvier_Shop

cp .env.production.example .env.production
chmod 600 .env.production
nano .env.production
```

En `.env.production` define contraseñas y secretos únicos. Establece al menos:

```dotenv
NEXT_PUBLIC_SITE_URL="https://tu-dominio.com"
APP_PORT="3001"
```

No subas ese archivo al repositorio. Después despliega y comprueba la API local:

```bash
bash scripts/unix/production-deploy.sh
curl --fail http://127.0.0.1:3001/api/health
docker compose --env-file .env.production -f compose.production.yaml ps
```

El servicio web de producción ya se publica sólo en `127.0.0.1:3001`; no cambies
esa restricción ni abras el puerto 3001 en el firewall.

## 3. Instalar Cloudflare Tunnel

En Cloudflare entra a **Networking → Tunnels**, crea un túnel con nombre
`janvier-produccion`, elige el conector `cloudflared` y copia el token que muestra
el panel. Trátalo como una contraseña: no lo guardes en Git ni lo pegues aquí.

Instala el paquete oficial en Ubuntu y registra el servicio:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | \
  sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update
sudo apt-get install -y cloudflared

sudo cloudflared service install '<TOKEN_DEL_TUNEL>'
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

En el detalle de ese túnel, agrega rutas de aplicación publicadas:

| Hostname público | Service URL |
| --- | --- |
| `tu-dominio.com` | `http://127.0.0.1:3001` |
| `www.tu-dominio.com` | `http://127.0.0.1:3001` |

Cloudflare crea los CNAME del túnel automáticamente al guardar cada ruta. Elige
uno de los dos hostnames como canónico y crea una redirección para el otro desde
Cloudflare si deseas que las URLs no se dupliquen.

## 4. Firewall y verificación externa

Mantén únicamente SSH abierto. Antes de activar UFW, confirma que tienes una
segunda sesión SSH conectada para no bloquearte:

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw enable
sudo ufw status verbose
```

No agregues reglas para 80, 443, 3001, 5432 ni Docker. Comprueba el túnel y el
sitio:

```bash
sudo systemctl status cloudflared --no-pager
sudo journalctl -u cloudflared -n 100 --no-pager
curl -I https://tu-dominio.com
curl -fsS https://tu-dominio.com/api/health
```

Si Cloudflare muestra un error 502, primero verifica
`curl http://127.0.0.1:3001/api/health` en Ubuntu y después los logs del túnel.

## 5. Respaldo diario cifrado al repositorio independiente

Después de actualizar el servidor con esta rama, sigue
[PRODUCTION_BACKUP_TO_GIT.md](PRODUCTION_BACKUP_TO_GIT.md). El temporizador:

- crea dump de PostgreSQL, activos privados y una copia de `.env.production`;
- cifra todo antes del commit;
- hace push a `AngelJanvier01/Janvier_Shop_Backups`;
- borra el directorio temporal local cuando el push termina correctamente.

Guarda la clave privada de `age` fuera del servidor; sin ella no se puede
restaurar un respaldo. Ejecuta una restauración de prueba antes de depender de
este sistema.

## Actualizar la aplicación

Antes de actualizar, ejecuta un respaldo manual exitoso. Después:

```bash
cd /srv/janvier/Janvier_Shop
git fetch origin
git switch NewV_2.0
git pull --ff-only origin NewV_2.0
bash scripts/unix/production-deploy.sh
curl --fail http://127.0.0.1:3001/api/health
```

Para revisar servicios:

```bash
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=200 web
sudo journalctl -u cloudflared -n 100 --no-pager
sudo systemctl list-timers janvier-backup.timer
```

## Referencias oficiales

- [Cloudflare Tunnel: configuración y rutas publicadas](https://developers.cloudflare.com/tunnel/setup/)
- [Cloudflare Tunnel en Linux como servicio](https://developers.cloudflare.com/tunnel/advanced/local-management/as-a-service/linux/)
- [Instalación de cloudflared en Debian/Ubuntu](https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/)
