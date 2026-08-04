# ADMIN_GMAIL_OAUTH_DELIVERY

## Alcance de v2.0.2

JANVIER incorpora una configuración administrativa para entregar el correo transaccional mediante Gmail API. La cola `EmailOutbox`, sus locks, reintentos, deduplicación, estados `DEAD` y el `Message-ID` estable se conservan. La entrega permanece apagada hasta que el servidor establezca explícitamente `MAIL_ENABLED="true"`; la interfaz no puede cambiar ese valor.

El hito no lee Gmail, no busca mensajes, no crea borradores, no administra etiquetas ni contactos y no admite contraseñas de Google ni contraseñas de aplicación.

## Arquitectura

`/admin/ajustes/correo` sólo presenta el estado seguro del bootstrap y de la conexión. Los secretos bootstrap viven exclusivamente en el entorno del servidor. El refresh token de Google se cifra con `EncryptedSettingsVault` antes de persistirse en `NotificationDeliveryConfiguration`; no se guarda access token.

El vault usa AES-256-GCM, una llave maestra de 32 bytes de `SETTINGS_ENCRYPTION_KEY`, nonce aleatorio de 96 bits, authentication tag, AAD (`provider`, `recordId`, `fieldName`, `encryptionVersion`) y formato versionado `v1.nonce.tag.payload` codificado Base64 URL-safe. Base64 no es el cifrado: sólo representa las partes cifradas.

Al despachar, el proveedor descifra el refresh token en memoria, obtiene un access token temporal, envía un MIME `multipart/alternative` a Gmail API y desecha el access token. El mismo `EmailOutbox.id` mantiene el mismo `Message-ID`; esto favorece trazabilidad y deduplicación, pero no garantiza entrega exactamente una vez.

## OAuth

Scopes exactos:

```text
openid
email
profile
https://www.googleapis.com/auth/gmail.send
```

Each authorization uses independent 256-bit `state` and OIDC `nonce` values. JANVIER persists only SHA-256 hashes, binds them to the administrator and session, expires them in 10 minutes, and consumes state atomically. The signed ID token must match the nonce hash before its identity is accepted.

El flujo es OAuth 2.0 de servidor: `response_type=code`, `access_type=offline` e `include_granted_scopes=true`. El consentimiento explícito se usa en conexión y reconexión, para asegurar refresh token. `state` tiene 256 bits, se guarda sólo como SHA-256, se asocia a administrador y sesión, vence en 10 minutos y se consume atómicamente para impedir replay. El callback valida sesión, state, expiración, emisor, audience, expiración del ID token, email verificado, cuenta permitida y scopes. El código y los tokens nunca regresan al navegador ni se registran.

Opcionalmente se restringe la identidad firmada con `GOOGLE_ALLOWED_EMAIL` y/o `GOOGLE_ALLOWED_DOMAIN`; si ambas existen, ambas deben coincidir. El parámetro `login_hint` no se utiliza como autorización.

## Google Cloud

1. Crear o seleccionar un proyecto de Google Cloud.
2. Habilitar Gmail API.
3. Configurar OAuth consent screen y, mientras esté en testing, agregar el usuario de prueba permitido.
4. Crear un OAuth Client de tipo **Web application**.
5. Registrar exactamente `GOOGLE_OAUTH_REDIRECT_URI` como URI autorizada.
6. Instalar las variables sólo en el entorno de producción y reiniciar de acuerdo con el runbook de despliegue.
7. Abrir Ajustes → Correo y notificaciones y pulsar **Conectar con Google**.

Con `GOOGLE_OAUTH_PUBLISHING_STATUS="testing"` la interfaz advierte que Google puede caducar la autorización tras siete días. Para una conexión persistente, completar la publicación de Google Auth Platform. La variable es informativa; no concede ni restringe permisos.

## Variables de entorno

```dotenv
MAIL_ENABLED="false"
GOOGLE_OAUTH_CLIENT_ID=""
GOOGLE_OAUTH_CLIENT_SECRET=""
GOOGLE_OAUTH_REDIRECT_URI="https://example.com/api/admin/settings/email/google/callback"
SETTINGS_ENCRYPTION_KEY=""
GOOGLE_ALLOWED_EMAIL=""
GOOGLE_ALLOWED_DOMAIN=""
GOOGLE_OAUTH_PUBLISHING_STATUS="testing"
```

Generar la llave fuera del repositorio y copiarla únicamente al almacén de secretos del servidor:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

No ejecutar ese comando en una terminal registrada ni guardar su resultado en `.env.example`, commits, tickets o logs. Una rotación de llave requiere un procedimiento de descifrado y recifrado planificado antes de sustituir la llave; cambiarla sin ese procedimiento impedirá usar los refresh tokens existentes.

## Operación y seguridad

- `MAIL_ENABLED=false` bloquea worker, cola de prueba y envío, aunque haya una cuenta conectada.
- `deliveryEnabled` es una preferencia adicional; nunca omite el kill switch.
- La comprobación de conexión sólo refresca identidad/capacidad; no lee Gmail ni envía un mensaje.
- Una prueba se encola como `TEST` en `EmailOutbox`; no llama Gmail directamente y sólo acepta cuenta conectada, destinatario administrativo o el propio administrador.
- Desconectar exige contraseña administrativa actual, confirmación, same-origin y rate limiting. Se intenta revocar remotamente, pero se borra siempre el secreto local; no se borran trabajos de `EmailOutbox`.
- `invalid_grant` o autorización revocada deben pausar entrega y requerir reconexión, no gastar intentos sin fin.
- Los errores y auditoría sólo contienen proveedor, estado, dominio de cuenta, conteo de scopes y código saneado; nunca tokens, authorization code, client secret, llave, cookies, cuerpos o destinatarios completos.

## Despliegue y rollback

Aplicar primero la migración Prisma con `MAIL_ENABLED="false"`. La migración conserva `EmailOutbox` y la configuración SMTP; el proveedor SMTP heredado sigue disponible para transición gradual. Después comprobar healthcheck y página administrativa, sin pulsar conexión si Google Cloud aún no está configurado.

Para rollback de aplicación, pausar entrega (`MAIL_ENABLED=false`) antes de volver al release anterior. No eliminar la tabla nueva ni la cola. La migración es aditiva; una reversión de esquema debe planearse por separado sólo después de retirar la aplicación v2.0.2 y verificar que no existen secretos cifrados a conservar.

## Diagnóstico

- **Bootstrap FALTANTE/INVÁLIDO:** corregir sólo el entorno de servidor; nunca pegar secretos en el navegador.
- **Cuenta rechazada:** revisar identidad firmada y `GOOGLE_ALLOWED_EMAIL`/`GOOGLE_ALLOWED_DOMAIN`.
- **Scope insuficiente o sin refresh token:** reconectar y aceptar el consentimiento; comprobar el estado de publicación de Google.
- **REVOKED/EXPIRED:** reconectar; no reutilizar tokens copiados manualmente.
- **DEGRADED:** mantener `deliveryEnabled=false`, revisar el código saneado y comprobar conexión de nuevo.

Las rutas de proveedor están diseñadas con un adapter inyectable para pruebas; las pruebas no llaman servicios Google reales.
