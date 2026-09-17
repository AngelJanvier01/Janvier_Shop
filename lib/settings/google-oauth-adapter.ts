import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";

import { assertGoogleOAuthBootstrap, googleOAuthScopes } from "./google-oauth-config";
import { matchesOAuthNonce } from "./google-oauth-state";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const revocationEndpoint = "https://oauth2.googleapis.com/revoke";
const issuerSet = new Set(["https://accounts.google.com", "accounts.google.com"]);
const googleJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs")
);

export type GoogleIdentity = {
  email: string;
  emailVerified: boolean;
  name: string | null;
  subject: string;
};

export type GoogleTokenExchange = {
  idToken: string;
  refreshToken: string | null;
  scopes: string[];
};

export type GoogleAccessToken = {
  accessToken: string;
  expiresIn: number;
  scopes: string[];
};

export interface GoogleOAuthAdapter {
  buildAuthorizationUrl(input: {
    nonce: string;
    promptConsent: boolean;
    state: string;
  }): string;
  exchangeAuthorizationCode(code: string): Promise<GoogleTokenExchange>;
  refreshAccessToken(refreshToken: string): Promise<GoogleAccessToken>;
  revokeToken(refreshToken: string): Promise<void>;
  verifyIdentity(input: { idToken: string; nonceHash: string }): Promise<GoogleIdentity>;
}

const tokenExchangeSchema = z.object({
  id_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional()
});
const refreshTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().nonnegative().optional(),
  scope: z.string().optional()
});

function normalizedScopes(value: unknown) {
  if (typeof value !== "string") return [];
  return [...new Set(value.split(/\s+/u).filter(Boolean))];
}

function safeProviderError(response: Response, fallback: string) {
  if (response.status >= 500 || response.status === 429)
    return new Error("GOOGLE_TEMPORARY");
  if (response.status === 401) return new Error("GOOGLE_UNAUTHORIZED");
  return new Error(fallback);
}

export const googleOAuthAdapter: GoogleOAuthAdapter = {
  buildAuthorizationUrl({ nonce, promptConsent, state }) {
    const bootstrap = assertGoogleOAuthBootstrap();
    const url = new URL(authorizationEndpoint);
    url.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!.trim());
    url.searchParams.set("redirect_uri", bootstrap.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("scope", googleOAuthScopes.join(" "));
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    if (promptConsent) url.searchParams.set("prompt", "consent");
    return url.toString();
  },
  async exchangeAuthorizationCode(code) {
    const bootstrap = assertGoogleOAuthBootstrap();
    const body = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
      code,
      grant_type: "authorization_code",
      redirect_uri: bootstrap.redirectUri
    });
    const response = await fetch(tokenEndpoint, {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw safeProviderError(response, "GOOGLE_CODE_EXCHANGE_FAILED");
    const data = tokenExchangeSchema.safeParse(await response.json());
    if (!data.success) throw new Error("GOOGLE_CODE_EXCHANGE_FAILED");
    return {
      idToken: data.data.id_token,
      refreshToken: data.data.refresh_token ?? null,
      scopes: normalizedScopes(data.data.scope)
    };
  },
  async refreshAccessToken(refreshToken) {
    const response = await fetch(tokenEndpoint, {
      body: new URLSearchParams({
        client_id:
          assertGoogleOAuthBootstrap() && process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!.trim(),
        grant_type: "refresh_token",
        refresh_token: refreshToken
      }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const code =
        payload && typeof payload === "object"
          ? (payload as { error?: unknown }).error
          : null;
      if (code === "invalid_grant") throw new Error("GOOGLE_INVALID_GRANT");
      throw safeProviderError(response, "GOOGLE_REFRESH_FAILED");
    }
    const data = refreshTokenSchema.safeParse(await response.json());
    if (!data.success) throw new Error("GOOGLE_REFRESH_FAILED");
    return {
      accessToken: data.data.access_token,
      expiresIn: data.data.expires_in ?? 0,
      scopes: normalizedScopes(data.data.scope)
    };
  },
  async revokeToken(refreshToken) {
    const response = await fetch(revocationEndpoint, {
      body: new URLSearchParams({ token: refreshToken }),
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST",
      signal: AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw safeProviderError(response, "GOOGLE_REVOKE_FAILED");
  },
  async verifyIdentity({ idToken, nonceHash }) {
    assertGoogleOAuthBootstrap();
    const verified = await jwtVerify(idToken, googleJwks, {
      audience: process.env.GOOGLE_OAUTH_CLIENT_ID!.trim(),
      issuer: [...issuerSet]
    });
    const payload = verified.payload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      payload.email_verified !== true ||
      typeof payload.nonce !== "string" ||
      !matchesOAuthNonce(payload.nonce, nonceHash)
    ) {
      throw new Error("GOOGLE_IDENTITY_INVALID");
    }
    return {
      email: payload.email.trim().toLowerCase(),
      emailVerified: true,
      name: typeof payload.name === "string" ? payload.name.slice(0, 255) : null,
      subject: payload.sub
    };
  }
};
