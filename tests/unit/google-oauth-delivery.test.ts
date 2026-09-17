import { afterEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createGmailRawMessage,
  GmailApiDeliveryProvider
} from "@/lib/notifications/delivery-provider";
import { database } from "@/lib/database";
import { encryptedSettingsVault } from "@/lib/settings/encrypted-settings-vault";
import {
  getGoogleOAuthBootstrap,
  googleOAuthScopes
} from "@/lib/settings/google-oauth-config";
import {
  hashOAuthState,
  hashOAuthNonce,
  matchesOAuthNonce,
  safeEmailSettingsReturnPath
} from "@/lib/settings/google-oauth-state";
import { googleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";
import type { GoogleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";

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
  vi.restoreAllMocks();
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

  it("rejects Gmail reading and alias-management additions statically", async () => {
    const sources = await Promise.all([
      readFile(resolve(process.cwd(), "lib/settings/google-oauth-config.ts"), "utf8"),
      readFile(resolve(process.cwd(), "lib/settings/google-oauth-adapter.ts"), "utf8"),
      readFile(resolve(process.cwd(), "lib/notifications/delivery-provider.ts"), "utf8")
    ]);
    const source = sources.join("\n");
    for (const forbidden of [
      "https://mail.google.com/",
      "gmail.readonly",
      "gmail.modify",
      "gmail.compose",
      "gmail.metadata",
      "gmail.settings.basic",
      "gmail.settings.sharing",
      "users.messages.list",
      "users.messages.get",
      "users.settings.sendAs.list",
      "users.settings.sendAs.get",
      "users.settings.sendAs.create",
      "/drafts",
      "/labels",
      "/threads",
      "/history"
    ]) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).toContain("/gmail/v1/users/me/messages/send");
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

  it("binds a separate 256-bit OIDC nonce and state to the signed callback", () => {
    const nonce = Buffer.alloc(32, 3).toString("base64url");
    const hash = hashOAuthNonce(nonce);
    expect(hash).toMatch(/^[a-f0-9]{64}$/u);
    expect(matchesOAuthNonce(nonce, hash)).toBe(true);
    expect(matchesOAuthNonce(`${nonce}x`, hash)).toBe(false);
    configureOAuthBootstrap();
    const url = new URL(
      googleOAuthAdapter.buildAuthorizationUrl({
        nonce,
        promptConsent: true,
        state: "state"
      })
    );
    expect(url.searchParams.get("nonce")).toBe(nonce);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
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

  it("uses a fake Gmail API adapter without reading Gmail or sending through SMTP", async () => {
    configureOAuthBootstrap();
    const encryptedRefreshToken = encryptedSettingsVault.encrypt("test-refresh-value", {
      fieldName: "refreshToken",
      provider: "GMAIL_API",
      recordId: "cfg_01"
    });
    const fakeAdapter: GoogleOAuthAdapter = {
      buildAuthorizationUrl: vi.fn(),
      exchangeAuthorizationCode: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: "in-memory-test-access-token",
        expiresIn: 300,
        scopes: ["https://www.googleapis.com/auth/gmail.send"]
      }),
      revokeToken: vi.fn(),
      verifyIdentity: vi.fn()
    };
    const updateMany = vi
      .spyOn(database.notificationDeliveryConfiguration, "updateMany")
      .mockResolvedValue({ count: 1 });
    const request = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "fake-gmail-message" }), { status: 200 })
      );
    const provider = new GmailApiDeliveryProvider(
      {
        connectedAccountEmail: "alerts@janvier.example",
        encryptedRefreshToken,
        grantedScopes: ["https://www.googleapis.com/auth/gmail.send"],
        id: "cfg_01",
        replyToEmail: null,
        senderEmail: "alerts@janvier.example",
        senderName: "JANVIER"
      },
      fakeAdapter
    );
    const result = await provider.sendMessage({
      html: "<p>Test</p>",
      messageId: "<email-outbox-cfg01@janvier.example>",
      recipient: "owner@example.com",
      subject: "Test",
      text: "Test"
    });
    expect(result.providerMessageId).toBe("fake-gmail-message");
    expect(request).toHaveBeenCalledWith(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
      expect.objectContaining({ method: "POST" })
    );
    expect(fakeAdapter.refreshAccessToken).toHaveBeenCalledWith("test-refresh-value");
    expect(updateMany).toHaveBeenCalledTimes(2);
  });

  it("classifies invalid_grant as reconnect-required without a delivery retry", async () => {
    configureOAuthBootstrap();
    const provider = new GmailApiDeliveryProvider(
      {
        connectedAccountEmail: "alerts@janvier.example",
        encryptedRefreshToken: encryptedSettingsVault.encrypt("test-refresh-value", {
          fieldName: "refreshToken",
          provider: "GMAIL_API",
          recordId: "cfg_01"
        }),
        grantedScopes: ["https://www.googleapis.com/auth/gmail.send"],
        id: "cfg_01",
        replyToEmail: null,
        senderEmail: "alerts@janvier.example",
        senderName: null
      },
      {
        buildAuthorizationUrl: vi.fn(),
        exchangeAuthorizationCode: vi.fn(),
        refreshAccessToken: vi.fn().mockRejectedValue(new Error("GOOGLE_INVALID_GRANT")),
        revokeToken: vi.fn(),
        verifyIdentity: vi.fn()
      }
    );
    const result = await provider.checkConnection();
    expect(result).toEqual({ code: "GOOGLE_INVALID_GRANT", ok: false });
    expect(provider.sanitizeError(new Error("GOOGLE_INVALID_GRANT"))).toMatchObject({
      reconnect: true
    });
  });
});
