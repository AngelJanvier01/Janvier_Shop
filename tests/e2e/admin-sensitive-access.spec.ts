import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";
import { hashPassword } from "../../lib/security/password";

test("an editor cannot open customer fiscal documents or payment evidence", async ({
  browser
}) => {
  const suffix = randomBytes(5).toString("hex");
  const editor = await database.adminUser.create({
    data: {
      email: `qa-editor-sensitive-${suffix}@example.test`,
      passwordHash: await hashPassword(`QA editor ${suffix} password`),
      role: "EDITOR"
    },
    select: { id: true }
  });
  const session = await createAdminSession(editor.id);
  const context = await browser.newContext();
  await context.addCookies([
    {
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
        .hostname,
      name: adminSessionCookieName,
      path: "/",
      value: session.token
    }
  ]);
  const page = await context.newPage();

  try {
    const customers = await page.goto("/admin/clientes", {
      waitUntil: "domcontentloaded"
    });
    expect(customers?.status()).toBe(200);
    await expect(page).toHaveURL(/\/admin\/acceso/u);

    const fiscalDocument = await page.goto(
      "/api/admin/customer-documents/not-a-real-document"
    );
    expect(fiscalDocument?.status()).toBe(403);

    const paymentProof = await page.goto("/api/commerce/spei-proofs/not-a-real-proof");
    expect(paymentProof?.status()).toBe(403);
  } finally {
    await context.close().catch(() => undefined);
    await database.adminUser.delete({ where: { id: editor.id } });
  }
});
