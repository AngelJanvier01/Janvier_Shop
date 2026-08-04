import { afterEach, describe, expect, it, vi } from "vitest";

import {
  assertEmailConfiguration,
  getEmailConfiguration
} from "@/lib/notifications/config";
import { dispatchPendingEmails } from "@/lib/notifications/dispatch";
import { emailOutboxMessageId } from "@/lib/notifications/message-id";
import { previousReportPeriod } from "@/lib/notifications/reports";
import { createJanvierEmail, sanitizeEmailSubject } from "@/lib/notifications/templates";

const mailEnvironmentKeys = [
  "ALERT_RECIPIENTS",
  "APP_URL",
  "MAIL_ENABLED",
  "MAIL_FROM",
  "MAIL_REPLY_TO",
  "SMTP_APP_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER"
] as const;
const originalEnvironment = Object.fromEntries(
  mailEnvironmentKeys.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of mailEnvironmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  vi.restoreAllMocks();
});

function configureMail() {
  process.env.MAIL_ENABLED = "true";
  process.env.APP_URL = "https://janvier.example";
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "465";
  process.env.SMTP_SECURE = "true";
  process.env.SMTP_USER = "alerts@example.com";
  process.env.SMTP_APP_PASSWORD = "app-password";
  process.env.MAIL_FROM = "JANVIER <alerts@example.com>";
  process.env.MAIL_REPLY_TO = "alerts@example.com";
  process.env.ALERT_RECIPIENTS = "owner@example.com, OWNER@example.com, invalid";
}

describe("JANVIER email notifications", () => {
  it("requires every private SMTP value and an HTTPS application URL", () => {
    configureMail();
    expect(getEmailConfiguration()).toMatchObject({
      alertRecipients: ["owner@example.com"],
      appUrl: "https://janvier.example",
      isConfigured: true,
      isEnabled: true,
      smtp: { port: 465, secure: true }
    });

    delete process.env.SMTP_APP_PASSWORD;
    expect(getEmailConfiguration().isConfigured).toBe(false);
    expect(() => assertEmailConfiguration()).toThrow(/Faltan variables SMTP/u);

    process.env.SMTP_APP_PASSWORD = "app-password";
    process.env.APP_URL = "http://localhost:3001";
    expect(getEmailConfiguration().isConfigured).toBe(false);
  });

  it("does not touch SMTP when MAIL_ENABLED is false", async () => {
    process.env.MAIL_ENABLED = "false";
    const result = await dispatchPendingEmails();
    expect(result).toEqual({ failed: 0, recovered: 0, sent: 0 });
  });

  it("escapes dynamic HTML, keeps text fallback and rejects CRLF subject injection", () => {
    const email = createJanvierEmail({
      actionLabel: "Open",
      actionUrl: "https://janvier.example/admin",
      details: [{ label: "Origin", value: "<script>alert(1)</script>" }],
      eyebrow: "security / login",
      summary: "A session started.",
      title: "Access detected",
      tone: "alert"
    });

    expect(email.html).toContain("JANVIER");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.html).toContain("https://janvier.example/admin");
    expect(email.text).toContain("Access detected");
    expect(email.text).toContain("Open: https://janvier.example/admin");
    expect(sanitizeEmailSubject("safe\r\nBcc: injected@example.com")).toBe(
      "safe Bcc: injected@example.com"
    );
  });

  it("derives the daily report interval from JANVIER_TIMEZONE rather than process time", () => {
    const period = previousReportPeriod(
      new Date("2026-08-04T13:00:00.000Z"),
      "America/Mexico_City"
    );
    expect(period.dayKey).toBe("2026-08-03");
    expect(period.since.toISOString()).toBe("2026-08-03T06:00:00.000Z");
    expect(period.until.toISOString()).toBe("2026-08-04T06:00:00.000Z");
  });

  it("keeps Message-ID stable per outbox job and private from recipients", () => {
    const testJobId = "cmailtest001";
    const firstAttempt = emailOutboxMessageId(testJobId, "https://janvier.example");
    const retriedAttempt = emailOutboxMessageId(testJobId, "https://janvier.example");
    const anotherJob = emailOutboxMessageId("cmailtest002", "https://janvier.example");

    expect(firstAttempt).toBe("<email-outbox-cmailtest001@janvier.example>");
    expect(retriedAttempt).toBe(firstAttempt);
    expect(anotherJob).not.toBe(firstAttempt);
    expect(firstAttempt).not.toContain("owner@example.com");
    expect(firstAttempt).toMatch(/^<email-outbox-[a-z0-9_-]+@janvier\.example>$/u);
    expect(emailOutboxMessageId(testJobId, "https://janvier.example")).toBe(firstAttempt);
  });
});
