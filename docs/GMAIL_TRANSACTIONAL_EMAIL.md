# Correo transaccional y alertas JANVIER

## Arquitectura segura

La peticion web nunca abre SMTP. Todo evento confirmado crea un mensaje minimo
en `EmailOutbox`, y un worker independiente lo entrega:

```text
evento confirmado -> enqueue -> PostgreSQL PENDING
-> UPDATE ... FOR UPDATE SKIP LOCKED -> PROCESSING
-> HTML/texto saneado -> SMTP TLS -> SENT | RETRY | DEAD
```

El claim es una sola sentencia SQL con un identificador de worker: dos workers
no pueden reclamar una misma fila. Un lock de mas de 10 minutos vuelve a `RETRY`.
Los reintentos son aproximadamente 1, 5, 15 y 60 minutos despues del primer
intento; el quinto fallo, un 5xx SMTP, autenticacion o envelope invalido queda en
`DEAD`. Se registra un error truncado y redaccionado, nunca la clave SMTP.

La cola guarda solo destinatario administrativo, asunto, HTML/texto renderizado,
tipo y metadatos operativos. No guarda contrasenas, hashes, cookies, tokens,
headers completos, Markdown, costos, secretos de invitacion ni claves SMTP.
Retencion: `SENT` 30 dias y `DEAD` 90 dias.

## Eventos y privacidad

- Login administrativo: alerta siempre por decision explicita; contiene cuenta,
  evento y expiracion, no IP completa ni cookie.
- Intentos limitados: una alerta por cuenta y hora tras 10 intentos en 15 min.
- Cambio de contrasena: exige sesion, contrasena actual, confirmacion, minimo de
  12 caracteres y limite de 5 intentos/15 min. Una transaccion actualiza hash,
  invalida sesiones y crea `AdminAuditEvent` antes de encolar.
- Contacto/diagnostico y eventos confirmados de propuestas: creada, compartida,
  primera vista, comentario, cambios, aceptacion, rechazo, revocacion y fallos
  relevantes. Previews, autosaves y vistas repetidas no alertan.
- Reporte diario: intervalo `[00:00, 00:00)` del dia anterior en
  `JANVIER_TIMEZONE`; la clave fecha/zona evita duplicados tras reinicio.

HTML usa estilos inline y UTF-8; hay texto plano, escaping de contenido dinamico,
asuntos sin CR/LF, sin JavaScript, tracking o imagenes remotas. Los botones solo
usan URL HTTPS visible tambien en el texto y el panel sigue requiriendo sesion.

Cada envio usa el encabezado MIME estable
`<email-outbox-{outboxId}@{dominio-de-APP_URL}>`. Un reintento del mismo trabajo
conserva exactamente ese `Message-ID`; trabajos distintos tienen otro. No incluye
destinatarios, tokens ni datos personales. Mejora trazabilidad y puede ayudar a
la deduplicacion del proveedor, pero no garantiza entrega SMTP exactamente una vez.

## Configuracion de Gmail

Activa verificacion en dos pasos y crea una contrasena de aplicacion. En
`/opt/janvier-shop/.env.production` define:

```env
MAIL_ENABLED="true"
APP_URL="https://tu-dominio.com"
JANVIER_TIMEZONE="America/Mexico_City"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_SECURE="true"
SMTP_USER="tu-correo@gmail.com"
SMTP_APP_PASSWORD="contrasena-de-aplicacion-de-gmail"
MAIL_FROM="JANVIER <tu-correo@gmail.com>"
MAIL_REPLY_TO="tu-correo@gmail.com"
ALERT_RECIPIENTS="tu-correo@gmail.com,segundo-destinatario@example.com"
```

Con `MAIL_ENABLED=false` no hay conexion SMTP, envio ni encolado. Si se activa
sin SMTP, destinatarios o `APP_URL` HTTPS validos, el worker falla sin secretos.
`SMTP_PASSWORD` solo es compatibilidad; para Gmail usa `SMTP_APP_PASSWORD`.

Preview local sin base ni SMTP:

```bash
npm run notifications:preview -- --output=/tmp/janvier-email-preview.json
```

Prueba controlada: solo crea y entrega correos `TEST`, nunca trabajos comerciales
ya pendientes:

```bash
cd /opt/janvier-shop
chmod 640 .env.production
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:test
```

## Workers systemd en Ubuntu

No instales timers antes de probar manualmente. Las unidades esperan un usuario
de sistema `janvier` con lectura del proyecto y socket Docker:

```bash
sudo useradd --system --create-home --shell /usr/sbin/nologin janvier 2>/dev/null || true
sudo usermod -aG docker janvier
sudo chgrp janvier /opt/janvier-shop/.env.production
sudo chmod 640 /opt/janvier-shop/.env.production
sudo install -m 644 scripts/systemd/janvier-email-dispatch.service /etc/systemd/system/
sudo install -m 644 scripts/systemd/janvier-email-dispatch.timer /etc/systemd/system/
sudo install -m 644 scripts/systemd/janvier-daily-report.service /etc/systemd/system/
sudo install -m 644 scripts/systemd/janvier-daily-report.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now janvier-email-dispatch.timer janvier-daily-report.timer
```

El worker usa `flock`, `oneshot`, `UMask=0077`, timeout y journal; no corre como
root. El reporte se programa a las 08:00 de `America/Mexico_City`. El grupo
Docker es una capacidad administrativa: limitelo a esta cuenta y admins fiables.
La deuda y criterio para retirarla estan en
[`JAN-TECH-015_SYSTEMD_NOTIFICATION_RUNNER.md`](JAN-TECH-015_SYSTEMD_NOTIFICATION_RUNNER.md).

```bash
systemctl status janvier-email-dispatch.timer janvier-daily-report.timer --no-pager
systemctl list-timers 'janvier-*'
sudo systemctl start janvier-email-dispatch.service
journalctl -u janvier-email-dispatch.service -n 100 --no-pager
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:status
```

El estado no muestra payloads ni destinatarios. El worker registra JSON con job,
tipo, intento, duracion, resultado y codigo; no contenido ni secretos.

Limpieza segura:

```bash
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:prune
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:prune -- --apply
```

Para detener timers sin borrar cola:

```bash
sudo systemctl disable --now janvier-email-dispatch.timer janvier-daily-report.timer
```

## Despliegue y rollback

Haz backup antes. El despliegue ejecuta `prisma migrate deploy` antes de renovar
la web. La migracion es aditiva y Prisma no hace rollback automatico: si falla la
version nueva, vuelve al commit anterior, reconstruye y conserva la tabla/columnas
nuevas compatibles. No uses `docker compose down -v`.
