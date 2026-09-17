# Configuración humana: Google Cloud y Gmail OAuth para JANVIER

## Objetivo y límites

Esta guía comienza sólo después del despliegue de v2.0.2 con el correo apagado. JANVIER solicita exclusivamente:

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.send
```

No autorizar `https://mail.google.com/`, lectura de Gmail, drafts, etiquetas, historial, contactos ni aliases. La única operación Gmail de JANVIER es `POST /gmail/v1/users/me/messages/send`, y sólo después de activar el kill switch en una fase futura.

## Variables de servidor

La ruta implementada es exactamente `/api/admin/settings/email/google/callback`.

```dotenv
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="https://jaanviieer.com/api/admin/settings/email/google/callback"
SETTINGS_ENCRYPTION_KEY=""
GOOGLE_ALLOWED_EMAIL=""
GOOGLE_ALLOWED_DOMAIN=""
GOOGLE_OAUTH_PUBLISHING_STATUS="testing"
MAIL_ENABLED="false"
```

`GOOGLE_ALLOWED_EMAIL` y `GOOGLE_ALLOWED_DOMAIN` son opcionales; si ambos existen, ambos deben coincidir con la identidad firmada. Nunca usar prefijos `NEXT_PUBLIC_` para secretos. `MAIL_ENABLED` permanece `false` durante toda esta guía.

## Proyecto Google Cloud

1. Crear o seleccionar un proyecto de Google Cloud.
2. Habilitar **Gmail API**.
3. Abrir Google Auth Platform y configurar nombre de aplicación, correo de soporte, audiencia y dominio autorizado `jaanviieer.com`.
4. Registrar política de privacidad y términos si Google los requiere para la audiencia elegida.
5. En Testing, añadir explícitamente la cuenta autorizada como test user.
6. Crear OAuth Client de tipo **Web application**, nombre sugerido `JANVIER Production`.
7. Registrar únicamente la redirect URI exacta anterior. No registrar localhost ni comodines en el cliente de producción.

## Testing y Production

En Testing, la cuenta debe ser test user y la autorización puede caducar; reconectar es normal. Para una conexión persistente, completar la publicación de Google Auth Platform. `GOOGLE_OAUTH_PUBLISHING_STATUS` sólo informa a la interfaz (`testing`, `production` o `unknown`); no habilita envío ni modifica autorización.

## Llave de cifrado

El parser real acepta exactamente Base64 URL-safe sin padding que represente 32 bytes. Generar el secreto fuera de Git y sin registrar la salida:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
# Alternativa OpenSSL con conversión explícita:
openssl rand -base64 32 | tr '+/' '-_' | tr -d '\n='
```

El resultado representa 32 bytes aleatorios y es secreto. No pegarlo en chats, tickets, logs ni, si puede evitarse, historial de shell; escribirlo directamente en `.env.production` mediante el procedimiento protegido. Guardar el archivo con permisos `600` y backup protegido. No reutilizar `AUTH_SECRET`, `SESSION_SECRET` ni una clave de base de datos. Sin la llave no se descifran refresh tokens existentes; una rotación exige recifrado planificado antes de cambiarla.

## Edición segura en Ubuntu

Pedir autorización humana, respaldar `.env.production`, usar `umask 077`, editar sin imprimir valores y restaurar permisos `600`. Validar sólo presencia de variables y `MAIL_ENABLED=false`; reiniciar únicamente `web`. No instalar timers todavía.

## Primera conexión sin enviar correo

1. Entrar como ADMIN en **Admin → Ajustes → Correo y notificaciones**.
2. Confirmar bootstrap configurado y redirect URI correcta.
3. Pulsar **Conectar con Google**; es navegación completa, no popup.
4. Elegir sólo la cuenta permitida y aceptar el alcance mínimo.
5. Al volver, comprobar cuenta parcialmente enmascarada y `GMAIL.SEND`.
6. Pulsar **Comprobar conexión**. Refresca capacidad OAuth sin leer Gmail ni enviar.
7. Previsualizar plantillas y revisar cola vacía; mantener `MAIL_ENABLED=false` y no encolar TEST.
8. Revisar logs saneados y respaldar configuración cifrada junto con su llave por un canal protegido.

## Activación posterior y separada

No realizar ahora. En una ventana de cambio posterior: habilitar `MAIL_ENABLED=true` en servidor, reiniciar sólo `web`, comprobar conexión, habilitar preferencia administrativa, encolar un único TEST, procesar un único trabajo manual, confirmar `SENT` y Message-ID estable, y sólo después evaluar timers y observabilidad.

No activar `deliveryEnabled` antes del kill switch. La web no puede cambiar `MAIL_ENABLED`.

## Desconexión, rotación y recuperación

Desconectar desde el panel exige contraseña actual, confirmación y versión de configuración; JANVIER intenta revocar Google y siempre elimina el secreto local, conservando EmailOutbox. `invalid_grant`, token revocado o Testing expirado requieren reconexión; la cola se conserva y no debe convertirse masivamente en `DEAD`.

Rotar client secret mediante edición protegida del entorno y reconexión. Para rotar encryption key, planear descifrado/recifrado antes del cambio. Recuperar backup sólo junto con la llave correspondiente y nunca copiar refresh tokens a tickets o chats.

## Troubleshooting

- `redirect_uri_mismatch`: comparar carácter por carácter la URI de Google y la variable.
- `access_denied` o test user missing: revisar audiencia y test users.
- `invalid_client`: revisar Client ID/secret únicamente en servidor.
- `invalid_grant` o token revoked: reconectar; no reutilizar tokens manualmente.
- `insufficient_scope`: reconectar y confirmar exclusivamente `gmail.send`.
- refresh token missing: repetir conexión con consentimiento; no reemplazar token existente con vacío.
- bootstrap missing o encryption key invalid: corregir entorno, permisos y formato Base64 URL-safe de 32 bytes.
- sender mismatch: el remitente debe ser cuenta conectada; no se administran aliases.
- `MAIL_ENABLED=false` o `deliveryEnabled=false`: bloqueos intencionales, no errores OAuth.
