const recipientPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export type EmailConfiguration = {
  alertRecipients: string[];
  from: string;
  isConfigured: boolean;
  isEnabled: boolean;
  smtp: {
    host: string;
    password: string;
    port: number;
    user: string;
  };
};

function readRecipients(value: string | undefined) {
  return [
    ...new Set((value ?? "").split(",").map((item) => item.trim().toLowerCase()))
  ].filter((item) => recipientPattern.test(item));
}

function readPort(value: string | undefined) {
  const port = Number(value ?? "465");
  return Number.isSafeInteger(port) && port > 0 && port <= 65535 ? port : 465;
}

export function getEmailConfiguration(): EmailConfiguration {
  const smtp = {
    host: process.env.SMTP_HOST?.trim() ?? "",
    password: process.env.SMTP_APP_PASSWORD?.trim() ?? "",
    port: readPort(process.env.SMTP_PORT),
    user: process.env.SMTP_USER?.trim() ?? ""
  };
  const alertRecipients = readRecipients(process.env.ALERT_RECIPIENTS);
  const from = process.env.MAIL_FROM?.trim() || smtp.user;
  const isConfigured = Boolean(
    smtp.host && smtp.password && smtp.user && from && alertRecipients.length
  );

  return {
    alertRecipients,
    from,
    isConfigured,
    isEnabled: process.env.MAIL_ENABLED === "true",
    smtp
  };
}

export function assertEmailConfiguration() {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled) {
    throw new Error("El correo transaccional está desactivado (MAIL_ENABLED=true).");
  }
  if (!configuration.isConfigured) {
    throw new Error("Faltan variables SMTP o ALERT_RECIPIENTS para enviar correo.");
  }
  return configuration;
}
