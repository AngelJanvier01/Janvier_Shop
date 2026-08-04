import { afterEach, describe, expect, it } from "vitest";

import { getEmailConfiguration } from "@/lib/notifications/config";
import { createJanvierEmail } from "@/lib/notifications/templates";

const mailEnvironmentKeys = [
  "ALERT_RECIPIENTS",
  "MAIL_ENABLED",
  "MAIL_FROM",
  "SMTP_APP_PASSWORD",
  "SMTP_HOST",
  "SMTP_PORT",
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
});

describe("JANVIER email notifications", () => {
  it("only treats email as configured when every private SMTP value is present", () => {
    process.env.MAIL_ENABLED = "true";
    process.env.SMTP_HOST = "smtp.gmail.com";
    process.env.SMTP_PORT = "465";
    process.env.SMTP_USER = "alerts@example.com";
    process.env.SMTP_APP_PASSWORD = "app-password";
    process.env.MAIL_FROM = "JANVIER <alerts@example.com>";
    process.env.ALERT_RECIPIENTS = "owner@example.com, OWNER@example.com, invalid";

    expect(getEmailConfiguration()).toMatchObject({
      alertRecipients: ["owner@example.com"],
      from: "JANVIER <alerts@example.com>",
      isConfigured: true,
      isEnabled: true,
      smtp: { port: 465 }
    });

    delete process.env.SMTP_APP_PASSWORD;
    expect(getEmailConfiguration().isConfigured).toBe(false);
  });

  it("escapes dynamic content in the branded HTML while preserving a text fallback", () => {
    const email = createJanvierEmail({
      details: [{ label: "Origin", value: "<script>alert(1)</script>" }],
      eyebrow: "security / login",
      summary: "A session started.",
      title: "Access detected",
      tone: "alert"
    });

    expect(email.html).toContain("JANVIER");
    expect(email.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(email.html).not.toContain("<script>alert(1)</script>");
    expect(email.text).toContain("Access detected");
    expect(email.text).toContain("Origin: <script>alert(1)</script>");
  });
});
