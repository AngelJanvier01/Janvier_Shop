const recipientPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type EmailConfiguration = {
  alertRecipients: string[];
  appUrl: string;
  from: string;
  isConfigured: boolean;
  isEnabled: boolean;
  replyTo: string;
  smtp: {
    host: string;
    password: string;
    port: number;
    secure: boolean;
    user: string;
  };
  timeZone: string;
};

function readBoolean(value: string | undefined, fallback: boolean) {
  if (value === undefined || value.trim() === "") return fallback;
  return value.trim().toLowerCase() === "true";
}

function readRecipients(value: string | undefined) {
  return [
    ...new Set((value ?? "").split(",").map((item) => item.trim().toLowerCase()))
  ].filter((item) => recipientPattern.test(item));
}

function readPort(value: string | undefined) {
  const port = Number(value ?? "465");
  return Number.isSafeInteger(port) && port > 0 && port <= 65535 ? port : 465;
}

function readAppUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return "";
  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    ) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

export function getEmailConfiguration(): EmailConfiguration {
  const smtp = {
    host: process.env.SMTP_HOST?.trim() ?? "",
    password:
      process.env.SMTP_APP_PASSWORD?.trim() || process.env.SMTP_PASSWORD?.trim() || "",
    port: readPort(process.env.SMTP_PORT),
    secure: readBoolean(process.env.SMTP_SECURE, true),
    user: process.env.SMTP_USER?.trim() ?? ""
  };
  const alertRecipients = readRecipients(
    process.env.ALERT_RECIPIENTS || process.env.ADMIN_NOTIFICATION_EMAIL
  );
  const from = process.env.MAIL_FROM?.trim() || smtp.user;
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || smtp.user;
  const appUrl = readAppUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_SITE_URL);
  const timeZone = process.env.JANVIER_TIMEZONE?.trim() || "America/Mexico_City";
  const isConfigured = Boolean(
    smtp.host &&
    smtp.password &&
    smtp.user &&
    from &&
    replyTo &&
    appUrl &&
    alertRecipients.length
  );

  return {
    alertRecipients,
    appUrl,
    from,
    isConfigured,
    isEnabled: process.env.MAIL_ENABLED === "true",
    replyTo,
    smtp,
    timeZone
  };
}

export function assertEmailConfiguration() {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled) {
    throw new Error("El correo transaccional esta desactivado (MAIL_ENABLED=true).");
  }
  if (!configuration.isConfigured) {
    throw new Error(
      "Faltan variables SMTP, destinatarios administrativos o una APP_URL HTTPS valida."
    );
  }
  return configuration;
}
