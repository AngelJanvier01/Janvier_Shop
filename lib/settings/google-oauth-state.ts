import { createHash, randomBytes } from "node:crypto";

import { database } from "@/lib/database";

const attemptLifetimeMs = 10 * 60_000;
const allowedReturnPaths = new Set(["/admin/ajustes/correo"]);

export function hashOAuthState(state: string) {
  return createHash("sha256").update(state).digest("hex");
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
  const now = new Date();
  await database.$transaction([
    database.googleOAuthAuthorizationAttempt.deleteMany({
      where: { expiresAt: { lt: now } }
    }),
    database.googleOAuthAuthorizationAttempt.create({
      data: {
        adminId: input.adminId,
        expiresAt: new Date(now.getTime() + attemptLifetimeMs),
        returnPath: safeEmailSettingsReturnPath(input.returnPath),
        sessionIdHash: input.sessionIdHash,
        stateHash: hashOAuthState(state)
      }
    })
  ]);
  return state;
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
    where: { consumedAt: null, id: attempt.id }
  });
  return claimed.count ? attempt : null;
}

export async function failGoogleOAuthAttempt(state: string, code: string) {
  await database.googleOAuthAuthorizationAttempt.updateMany({
    data: { consumedAt: new Date(), failureCode: code.slice(0, 96) },
    where: { consumedAt: null, stateHash: hashOAuthState(state) }
  });
}
