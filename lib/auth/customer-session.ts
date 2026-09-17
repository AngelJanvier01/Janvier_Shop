import { createHash, randomBytes } from "node:crypto";

import { database } from "../database";

export const customerSessionCookieName = "janvier_customer_session";
export const customerSessionMaxAge = 60 * 60 * 24 * 14;

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
  if (
    !session ||
    session.invalidatedAt ||
    session.expiresAt.getTime() <= Date.now() ||
    !session.user.isActive ||
    session.user.account.status !== "APPROVED"
  ) {
    return null;
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
