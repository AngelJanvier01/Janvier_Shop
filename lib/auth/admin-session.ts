import { createHash, randomBytes } from "node:crypto";

import { database } from "../database";

export const adminSessionCookieName = "janvier_admin_session";
const sessionLifetimeSeconds = 60 * 60 * 24 * 7;

export function hashAdminSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createAdminSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeSeconds * 1000);

  const session = await database.adminSession.create({
    data: {
      expiresAt,
      tokenHash: hashAdminSessionToken(token),
      userId
    }
  });

  return { expiresAt, id: session.id, token };
}

export async function getAdminFromSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const session = await database.adminSession.findUnique({
    include: { user: true },
    where: { tokenHash: hashAdminSessionToken(token) }
  });

  if (
    !session ||
    session.invalidatedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.user.isActive
  ) {
    return null;
  }

  return session.user;
}

export async function invalidateAdminSession(token: string | undefined) {
  if (!token) {
    return;
  }

  await database.adminSession.updateMany({
    data: { invalidatedAt: new Date() },
    where: {
      invalidatedAt: null,
      tokenHash: hashAdminSessionToken(token)
    }
  });
}

export const adminSessionMaxAge = sessionLifetimeSeconds;
