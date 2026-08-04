import nodemailer from "nodemailer";

import {
  NotificationDeliveryProvider as ProviderKind,
  NotificationDeliveryProviderStatus
} from "@/app/generated/prisma/client";
import { database } from "@/lib/database";
import { encryptedSettingsVault } from "@/lib/settings/encrypted-settings-vault";
import {
  googleOAuthAdapter,
  type GoogleOAuthAdapter
} from "@/lib/settings/google-oauth-adapter";

import { assertEmailConfiguration, getEmailConfiguration } from "./config";

export type DeliveryMessage = {
  html: string;
  messageId: string;
  recipient: string;
  subject: string;
  text: string;
};
export type ProviderValidation = { code?: string; ok: boolean };
export type ProviderConnectionResult = { code?: string; ok: boolean };
export type DeliveryResult = { providerMessageId?: string };
export type SanitizedProviderError = {
  code: string;
  message: string;
  permanent: boolean;
  reconnect?: boolean;
};

export interface NotificationDeliveryProvider {
  checkConnection(): Promise<ProviderConnectionResult>;
  disconnect(): Promise<void>;
  sanitizeError(error: unknown): SanitizedProviderError;
  sendMessage(message: DeliveryMessage): Promise<DeliveryResult>;
  validateConfiguration(): Promise<ProviderValidation>;
}

function safeErrorCode(error: unknown) {
  return error instanceof Error && /^[A-Z_0-9-]{2,64}$/u.test(error.message)
    ? error.message
    : "DELIVERY_ERROR";
}

function header(value: string) {
  if (/[\r\n]/u.test(value)) throw new Error("HEADER_INVALID");
  return value.normalize("NFC");
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

export function createGmailRawMessage(
  input: DeliveryMessage & { from: string; replyTo?: string | null }
) {
  const boundary = `janvier-${input.messageId.replace(/[^a-zA-Z0-9]/gu, "").slice(-32)}`;
  const from = header(input.from);
  const to = header(input.recipient);
  const subject = header(input.subject);
  const replyTo = input.replyTo ? `Reply-To: ${header(input.replyTo)}\r\n` : "";
  const mime = [
    `From: ${from}`,
    `To: ${to}`,
    replyTo.trimEnd(),
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${input.messageId}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.text,
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    input.html,
    `--${boundary}--`,
    ""
  ]
    .filter((line, index) => line || index > 4)
    .join("\r\n");
  return encodeBase64Url(mime);
}

export class DisabledDeliveryProvider implements NotificationDeliveryProvider {
  async validateConfiguration() {
    return { code: "MAIL_DISABLED", ok: false };
  }
  async checkConnection() {
    return { code: "MAIL_DISABLED", ok: false };
  }
  async disconnect() {}
  async sendMessage(_message: DeliveryMessage): Promise<DeliveryResult> {
    void _message;
    throw new Error("MAIL_DISABLED");
  }
  sanitizeError() {
    return {
      code: "MAIL_DISABLED",
      message: "La entrega esta desactivada.",
      permanent: false
    };
  }
}

export class SmtpDeliveryProvider implements NotificationDeliveryProvider {
  async validateConfiguration() {
    return { ok: getEmailConfiguration().isConfigured };
  }
  async checkConnection() {
    try {
      const configuration = assertEmailConfiguration();
      const transport = nodemailer.createTransport({
        auth: { pass: configuration.smtp.password, user: configuration.smtp.user },
        connectionTimeout: 10_000,
        host: configuration.smtp.host,
        port: configuration.smtp.port,
        secure: configuration.smtp.secure,
        tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }
      });
      await transport.verify();
      return { ok: true };
    } catch (error) {
      return { code: safeErrorCode(error), ok: false };
    }
  }
  async disconnect() {}
  async sendMessage(message: DeliveryMessage) {
    const configuration = assertEmailConfiguration();
    const transport = nodemailer.createTransport({
      auth: { pass: configuration.smtp.password, user: configuration.smtp.user },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      host: configuration.smtp.host,
      port: configuration.smtp.port,
      secure: configuration.smtp.secure,
      socketTimeout: 30_000,
      tls: { minVersion: "TLSv1.2", rejectUnauthorized: true }
    });
    const response = await transport.sendMail({
      from: configuration.from,
      html: message.html,
      messageId: message.messageId,
      replyTo: configuration.replyTo,
      subject: message.subject,
      text: message.text,
      to: message.recipient
    });
    return { providerMessageId: response.messageId };
  }
  sanitizeError(error: unknown) {
    const candidate = error as { code?: unknown; responseCode?: unknown };
    const code =
      typeof candidate?.code === "string" ? candidate.code.toUpperCase() : "SMTP_ERROR";
    const responseCode =
      typeof candidate?.responseCode === "number" ? candidate.responseCode : undefined;
    return {
      code: responseCode ? `SMTP_${responseCode}` : code,
      message: "No fue posible entregar el correo mediante SMTP.",
      permanent:
        new Set(["EAUTH", "EENVELOPE", "EMESSAGE", "EINVALIDRECIPIENT"]).has(code) ||
        Boolean(responseCode && responseCode >= 500 && responseCode < 600)
    };
  }
}

export class GmailApiDeliveryProvider implements NotificationDeliveryProvider {
  constructor(
    private readonly configuration: {
      connectedAccountEmail: string | null;
      encryptedRefreshToken: string | null;
      grantedScopes: string[];
      id: string;
      replyToEmail: string | null;
      senderEmail: string | null;
      senderName: string | null;
    },
    private readonly adapter: GoogleOAuthAdapter = googleOAuthAdapter
  ) {}

  async validateConfiguration() {
    return {
      code:
        this.configuration.encryptedRefreshToken &&
        this.configuration.senderEmail &&
        this.configuration.connectedAccountEmail &&
        this.configuration.grantedScopes.includes(
          "https://www.googleapis.com/auth/gmail.send"
        ) &&
        this.configuration.senderEmail.trim().toLowerCase() ===
          this.configuration.connectedAccountEmail.trim().toLowerCase() &&
        (!this.configuration.replyToEmail ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(this.configuration.replyToEmail))
          ? undefined
          : "GMAIL_NOT_CONFIGURED",
      ok: Boolean(
        this.configuration.encryptedRefreshToken &&
        this.configuration.senderEmail &&
        this.configuration.connectedAccountEmail &&
        this.configuration.grantedScopes.includes(
          "https://www.googleapis.com/auth/gmail.send"
        ) &&
        this.configuration.senderEmail.trim().toLowerCase() ===
          this.configuration.connectedAccountEmail.trim().toLowerCase() &&
        (!this.configuration.replyToEmail ||
          /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(this.configuration.replyToEmail))
      )
    };
  }
  async checkConnection() {
    try {
      await this.accessToken();
      return { ok: true };
    } catch (error) {
      return { code: safeErrorCode(error), ok: false };
    }
  }
  async disconnect() {}
  async sendMessage(message: DeliveryMessage) {
    const accessToken = await this.accessToken();
    const from = this.configuration.senderName
      ? `${header(this.configuration.senderName)} <${this.configuration.senderEmail}>`
      : this.configuration.senderEmail!;
    const raw = createGmailRawMessage({
      ...message,
      from,
      replyTo: this.configuration.replyToEmail
    });
    const response = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      {
        body: JSON.stringify({ raw }),
        headers: {
          authorization: `Bearer ${accessToken}`,
          "content-type": "application/json"
        },
        method: "POST",
        signal: AbortSignal.timeout(20_000)
      }
    );
    if (!response.ok)
      throw new Error(
        response.status >= 500 || response.status === 429
          ? "GOOGLE_TEMPORARY"
          : "GOOGLE_SEND_FAILED"
      );
    const payload: unknown = await response.json();
    await database.notificationDeliveryConfiguration.updateMany({
      data: { lastSuccessfulSendAt: new Date() },
      where: { id: this.configuration.id }
    });
    return {
      providerMessageId:
        payload &&
        typeof payload === "object" &&
        typeof (payload as { id?: unknown }).id === "string"
          ? (payload as { id: string }).id
          : undefined
    };
  }
  sanitizeError(error: unknown) {
    const code = safeErrorCode(error);
    return {
      code,
      message: "No fue posible entregar el correo mediante Gmail API.",
      permanent: [
        "GOOGLE_UNAUTHORIZED",
        "GOOGLE_SEND_FAILED",
        "GMAIL_NOT_CONFIGURED"
      ].includes(code),
      reconnect: ["GOOGLE_UNAUTHORIZED", "GOOGLE_INVALID_GRANT"].includes(code)
    };
  }
  private async accessToken() {
    if (!this.configuration.encryptedRefreshToken)
      throw new Error("GMAIL_NOT_CONFIGURED");
    const refreshToken = encryptedSettingsVault.decrypt(
      this.configuration.encryptedRefreshToken,
      {
        fieldName: "refreshToken",
        provider: ProviderKind.GMAIL_API,
        recordId: this.configuration.id
      }
    );
    const result = await this.adapter.refreshAccessToken(refreshToken);
    await database.notificationDeliveryConfiguration.updateMany({
      data: { lastSuccessfulTokenRefreshAt: new Date() },
      where: { id: this.configuration.id }
    });
    return result.accessToken;
  }
}

export async function getDeliveryProvider(): Promise<NotificationDeliveryProvider> {
  const configuration = await database.notificationDeliveryConfiguration.findUnique({
    where: { installationKey: "default" }
  });
  if (configuration?.provider === ProviderKind.GMAIL_API) {
    if (
      configuration.providerStatus === NotificationDeliveryProviderStatus.CONNECTED &&
      configuration.deliveryEnabled
    ) {
      return new GmailApiDeliveryProvider(configuration);
    }
    return new DisabledDeliveryProvider();
  }
  // Preserve v2.0.1's SMTP migration path; the global kill switch remains in the worker.
  if (getEmailConfiguration().isConfigured) return new SmtpDeliveryProvider();
  return new DisabledDeliveryProvider();
}

export async function isDeliveryQueueReady() {
  const provider = await getDeliveryProvider();
  return (await provider.validateConfiguration()).ok;
}
