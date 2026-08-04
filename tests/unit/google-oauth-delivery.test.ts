import { afterEach, describe, expect, it } from "vitest";

import { createGmailRawMessage } from "@/lib/notifications/delivery-provider";
import { encryptedSettingsVault } from "@/lib/settings/encrypted-settings-vault";
import {
  getGoogleOAuthBootstrap,
  googleOAuthScopes
} from "@/lib/settings/google-oauth-config";
import {
  hashOAuthState,
  safeEmailSettingsReturnPath
} from "@/lib/settings/google-oauth-state";

const environmentKeys = [
  "GOOGLE_OAUTH_CLIENT_ID",
  "GOOGLE_OAUTH_CLIENT_SECRET",
  "GOOGLE_OAUTH_REDIRECT_URI",
  "GOOGLE_ALLOWED_EMAIL",
  "GOOGLE_ALLOWED_DOMAIN",
  "SETTINGS_ENCRYPTION_KEY"
] as const;
const originalEnvironment = Object.fromEntries(
  environmentKeys.map((key) => [key, process.env[key]])
);

afterEach(() => {
  for (const key of environmentKeys) {
    const value = originalEnvironment[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function configureOAuthBootstrap() {
  process.env.GOOGLE_OAUTH_CLIENT_ID = "test-client";
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = "test-secret-placeholder";
  process.env.GOOGLE_OAUTH_REDIRECT_URI =
    "https://janvier.example/api/admin/settings/email/google/callback";
  process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64url");
}

describe("Gmail OAuth delivery foundation", () => {
  it("requests only identity and gmail.send scopes", () => {
    expect(googleOAuthScopes).toEqual([
      "openid",
      "email",
      "profile",
      "https://www.googleapis.com/auth/gmail.send"
    ]);
    expect(googleOAuthScopes.join(" ")).not.toMatch(
      /gmail\.readonly|gmail\.modify|mail\.google\.com/u
    );
  });

  it("reports bootstrap status without exposing bootstrap values", () => {
    configureOAuthBootstrap();
    const bootstrap = getGoogleOAuthBootstrap();
    expect(bootstrap.configured).toBe(true);
    expect(bootstrap.encryptionKeyConfigured).toBe(true);
    expect(bootstrap.redirectUri).toBe(
      "https://janvier.example/api/admin/settings/email/google/callback"
    );
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    expect(getGoogleOAuthBootstrap().configured).toBe(false);
  });

  it("uses unique authenticated ciphertexts and rejects tampering", () => {
    configureOAuthBootstrap();
    const context = {
      fieldName: "refreshToken",
      provider: "GMAIL_API",
      recordId: "cfg_01"
    };
    const first = encryptedSettingsVault.encrypt("non-production-test-value", context);
    const second = encryptedSettingsVault.encrypt("non-production-test-value", context);
    expect(first).not.toBe(second);
    expect(encryptedSettingsVault.decrypt(first, context)).toBe(
      "non-production-test-value"
    );
    expect(() => encryptedSettingsVault.decrypt(`${first}x`, context)).toThrow(
      /descifrar|invalido/u
    );
    expect(() =>
      encryptedSettingsVault.decrypt(first, { ...context, recordId: "cfg_02" })
    ).toThrow(/descifrar/u);
  });

  it("uses deterministic state hashes and a strict internal redirect allowlist", () => {
    expect(hashOAuthState("state-a")).toMatch(/^[a-f0-9]{64}$/u);
    expect(hashOAuthState("state-a")).toBe(hashOAuthState("state-a"));
    expect(hashOAuthState("state-b")).not.toBe(hashOAuthState("state-a"));
    expect(safeEmailSettingsReturnPath("/admin/ajustes/correo")).toBe(
      "/admin/ajustes/correo"
    );
    expect(safeEmailSettingsReturnPath("https://attacker.invalid")).toBe(
      "/admin/ajustes/correo"
    );
  });

  it("builds a Gmail API MIME message with stable caller-provided Message-ID and URL-safe raw data", () => {
    const raw = createGmailRawMessage({
      from: "JANVIER <alerts@janvier.example>",
      html: "<p>Hola</p>",
      messageId: "<email-outbox-cmailtest001@janvier.example>",
      recipient: "owner@example.com",
      replyTo: "reply@janvier.example",
      subject: "Prueba",
      text: "Hola"
    });
    const mime = Buffer.from(raw, "base64url").toString("utf8");
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/u);
    expect(mime).toContain("Message-ID: <email-outbox-cmailtest001@janvier.example>");
    expect(mime).toContain("Content-Type: multipart/alternative");
    expect(mime).toContain("Reply-To: reply@janvier.example");
    expect(() =>
      createGmailRawMessage({
        from: "JANVIER <alerts@janvier.example>",
        html: "x",
        messageId: "<id@example.com>",
        recipient: "a@example.com",
        subject: "safe\r\nBcc: attack",
        text: "x"
      })
    ).toThrow(/HEADER_INVALID/u);
  });
});
