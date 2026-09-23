import { createHash, randomBytes } from "node:crypto";

import { database } from "../database";

export const customerSessionCookieName = "janvier_customer_session";
export const customerSessionMaxAge = 60 * 60 * 24 * 14;
export const customerSessionIdleTimeoutMs = 60 * 60 * 1000;
const customerSessionTouchIntervalMs = 5 * 60 * 1000;

function hashCustomerSessionToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export async function createCustomerSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + customerSessionMaxAge * 1000);
  await database.customerSession.create({
    data: { expiresAt, tokenHash: hashCustomerSessionToken(token), userId }
  });
  return { expiresAt, token };
}

export async function getCustomerFromSessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  const session = await database.customerSession.findUnique({
    include: { user: { include: { account: true } } },
    where: { tokenHash: hashCustomerSessionToken(token) }
  });
  const now = Date.now();
  if (
    !session ||
    session.invalidatedAt ||
    session.expiresAt.getTime() <= now ||
    !session.user.isActive ||
    session.user.account.status !== "APPROVED"
  ) {
    return null;
  }

  if (session.lastSeenAt.getTime() + customerSessionIdleTimeoutMs <= now) {
    await database.customerSession.updateMany({
      data: { invalidatedAt: new Date(now) },
      where: { id: session.id, invalidatedAt: null }
    });
    return null;
  }

  if (session.lastSeenAt.getTime() + customerSessionTouchIntervalMs <= now) {
    await database.customerSession.updateMany({
      data: { lastSeenAt: new Date(now) },
      where: { id: session.id, invalidatedAt: null }
    });
  }

  return session.user;
}

export async function invalidateCustomerSession(token: string | undefined) {
  if (!token) {
    return;
  }
  await database.customerSession.updateMany({
    data: { invalidatedAt: new Date() },
    where: { invalidatedAt: null, tokenHash: hashCustomerSessionToken(token) }
  });
}
