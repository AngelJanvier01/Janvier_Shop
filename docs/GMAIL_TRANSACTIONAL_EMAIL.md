# Alertas por Gmail

JANVIER usa una cola persistente en PostgreSQL para sus avisos. Un login, una
solicitud o una propuesta sólo agrega un mensaje a la cola: Gmail se procesa en
segundo plano con reintentos. Por eso el panel no deja de funcionar si el correo
está temporalmente caído.

## Eventos cubiertos

- Inicio de sesión administrativo y bloqueo por demasiados intentos.
- Cambio de contraseña; invalida todas las sesiones activas.
- Nueva solicitud desde Contacto o Diagnóstico.
- Eventos importantes de Project Room: propuesta creada, compartida, vista,
  comentario, solicitud de cambio, aceptación, rechazo, revocación y fallos de
  activos/comercial.
- Resumen operativo diario: solicitudes, propuestas, vistas y actividad web.

Los correos se dirigen a `ALERT_RECIPIENTS`; no se envía una contraseña, código
de acceso ni contenido privado completo por email.

## Configurar Gmail

1. Usa una cuenta dedicada para alertas o la cuenta de operación de JANVIER.
2. Activa la verificación en dos pasos de esa cuenta Google.
3. En la sección **Contraseñas de aplicaciones**, genera una con nombre
   `JANVIER servidor`. No uses tu contraseña normal de Gmail.
4. En el Ubuntu, edita `/opt/janvier-shop/.env.production` y define:

```env
MAIL_ENABLED="true"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="465"
SMTP_USER="tu-correo@gmail.com"
SMTP_APP_PASSWORD="la-contraseña-de-aplicacion-de-16-caracteres"
MAIL_FROM="JANVIER <tu-correo@gmail.com>"
ALERT_RECIPIENTS="tu-correo@gmail.com,segundo-destinatario@example.com"
```

5. Restringe el archivo y reconstruye el contenedor:

```bash
chmod 600 /opt/janvier-shop/.env.production
cd /opt/janvier-shop
docker compose --env-file .env.production -f compose.production.yaml up -d --build
docker compose --env-file .env.production -f compose.production.yaml run --rm --no-deps migrate npm run notifications:test
```

El último comando debe indicar `queued` y `sent` mayores que cero. Si Google
rechaza el envío, revisa que la verificación en dos pasos siga activa y genera
una contraseña de aplicación nueva; Google revoca estas contraseñas cuando se
cambia la contraseña principal.

## Activar procesamiento automático

```bash
sudo cp scripts/systemd/janvier-email-dispatch.service /etc/systemd/system/
sudo cp scripts/systemd/janvier-email-dispatch.timer /etc/systemd/system/
sudo cp scripts/systemd/janvier-daily-report.service /etc/systemd/system/
sudo cp scripts/systemd/janvier-daily-report.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now janvier-email-dispatch.timer janvier-daily-report.timer
systemctl list-timers 'janvier-*'
```

El despachador se ejecuta cada minuto. El resumen se agrega diariamente a las
08:00 (hora del servidor; configura `JANVIER_TIMEZONE=America/Mexico_City`).

Para revisar errores sin exponer secretos:

```bash
journalctl -u janvier-email-dispatch.service -n 100 --no-pager
```

Nunca agregues la contraseña de aplicación al repositorio ni a variables
`NEXT_PUBLIC_*`.
