const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const domainPattern =
  /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/iu;

export const googleOAuthScopes = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.send"
] as const;

function hasValidEncryptionKey(value: string) {
  return (
    /^[A-Za-z0-9_-]{43}$/u.test(value) &&
    Buffer.from(value, "base64url").toString("base64url") === value
  );
}

export function getGoogleOAuthBootstrap() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ?? "";
  const allowedEmail = process.env.GOOGLE_ALLOWED_EMAIL?.trim().toLowerCase() ?? "";
  const allowedDomain = process.env.GOOGLE_ALLOWED_DOMAIN?.trim().toLowerCase() ?? "";
  const encryptionKey = process.env.SETTINGS_ENCRYPTION_KEY?.trim() ?? "";
  let redirectUriValid = false;
  try {
    const url = new URL(redirectUri);
    redirectUriValid = url.protocol === "https:" && !url.username && !url.password;
  } catch {}
  return {
    allowedDomain: domainPattern.test(allowedDomain) ? allowedDomain : "",
    allowedEmail: emailPattern.test(allowedEmail) ? allowedEmail : "",
    clientIdConfigured: Boolean(clientId),
    clientSecretConfigured: Boolean(clientSecret),
    configured: Boolean(
      clientId && clientSecret && hasValidEncryptionKey(encryptionKey) && redirectUriValid
    ),
    encryptionKeyConfigured: hasValidEncryptionKey(encryptionKey),
    publishingStatus: ["testing", "production"].includes(
      process.env.GOOGLE_OAUTH_PUBLISHING_STATUS ?? "testing"
    )
      ? (process.env.GOOGLE_OAUTH_PUBLISHING_STATUS ?? "testing")
      : "unknown",
    redirectUri,
    redirectUriValid
  };
}

export function assertGoogleOAuthBootstrap() {
  const bootstrap = getGoogleOAuthBootstrap();
  if (!bootstrap.configured)
    throw new Error("La configuracion OAuth de Google esta incompleta o es invalida.");
  return bootstrap;
}
