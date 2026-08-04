import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { database } from "@/lib/database";

const attemptLifetimeMs = 10 * 60_000;
const consumedAttemptRetentionMs = 7 * 24 * 60 * 60_000;
const allowedReturnPaths = new Set(["/admin/ajustes/correo"]);

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
}

export function hashOAuthNonce(nonce: string) {
  return createHash("sha256").update(nonce).digest("hex");
}

export function matchesOAuthNonce(nonce: string, expectedHash: string) {
  const actual = Buffer.from(hashOAuthNonce(nonce), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeEmailSettingsReturnPath(value: string | null | undefined) {
  return value && allowedReturnPaths.has(value) ? value : "/admin/ajustes/correo";
}

export async function createGoogleOAuthAttempt(input: {
  adminId: string;
  returnPath: string | null | undefined;
  sessionIdHash: string;
}) {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const now = new Date();
  await database.$transaction([
    database.googleOAuthAuthorizationAttempt.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: now } },
          { consumedAt: { lt: new Date(now.getTime() - consumedAttemptRetentionMs) } }
        ]
      }
    }),
    database.googleOAuthAuthorizationAttempt.create({
      data: {
        adminId: input.adminId,
        expiresAt: new Date(now.getTime() + attemptLifetimeMs),
        nonceHash: hashOAuthNonce(nonce),
        returnPath: safeEmailSettingsReturnPath(input.returnPath),
        sessionIdHash: input.sessionIdHash,
        stateHash: hashOAuthState(state)
      }
    })
  ]);
  return { nonce, state };
}

/** Atomically consumes the state, preventing callback replay even under races. */
export async function consumeGoogleOAuthAttempt(input: {
  adminId: string;
  sessionIdHash: string;
  state: string;
}) {
  const stateHash = hashOAuthState(input.state);
  const now = new Date();
  const attempt = await database.googleOAuthAuthorizationAttempt.findFirst({
    where: { adminId: input.adminId, sessionIdHash: input.sessionIdHash, stateHash }
  });
  if (!attempt || attempt.consumedAt || attempt.expiresAt <= now) return null;
  const claimed = await database.googleOAuthAuthorizationAttempt.updateMany({
    data: { consumedAt: now },
    where: { consumedAt: null, expiresAt: { gt: now }, id: attempt.id }
  });
  return claimed.count ? attempt : null;
}

export async function failGoogleOAuthAttempt(state: string, code: string) {
  await database.googleOAuthAuthorizationAttempt.updateMany({
    data: { failureCode: code.slice(0, 96) },
    where: { stateHash: hashOAuthState(state) }
  });
}
