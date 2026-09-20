import { expect, test } from "@playwright/test";

import "dotenv/config";

import {
  createCustomerSession,
  customerSessionCookieName
} from "../../lib/auth/customer-session";
import { database } from "../../lib/database";

test("shows a safe checkout when Mercado Pago credentials are unavailable", async ({
  browser
}) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true, role: { in: ["ADMIN", "OWNER"] } }
  });
  const account = await database.customerAccount.create({
    data: {
      companyName: `CUENTA PAGO QA ${suffix}`,
      contactName: "CLIENTE DE PAGO QA",
      status: "APPROVED",
      users: {
        create: {
          email: `qa-payment-${suffix}@example.test`,
          isActive: true,
          name: "CLIENTE DE PAGO QA"
        }
      }
    },
    include: { users: { select: { id: true } } }
  });
  const product = await database.product.create({
    data: {
      brand: "JANVIER QA",
      category: "PRUEBAS",
      createdById: owner.id,
      description: "Producto temporal para validar el checkout comercial.",
      name: "PRODUCTO DE PAGO QA",
      sku: `QA-PAY-${suffix}`,
      slug: `qa-pay-${suffix}`,
      status: "PUBLISHED"
    },
    select: { id: true }
  });
  const reference = `PED-QA-PAY-${suffix}`;
  await database.commerceOrder.create({
    data: {
      accountId: account.id,
      confirmedAt: new Date(),
      items: {
        create: {
          productId: product.id,
          quantity: 2,
          snapshotName: "PRODUCTO DE PAGO QA",
          snapshotSku: `QA-PAY-${suffix}`,
          snapshotUnitPriceWithTax: 1500
        }
      },
      reference,
      requestedById: account.users[0]!.id,
      status: "CONFIRMED"
    }
  });
  const session = await createCustomerSession(account.users[0]!.id);
  const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
  await context.addCookies([
    {
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
        .hostname,
      name: customerSessionCookieName,
      path: "/",
      value: session.token
    }
  ]);
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  try {
    await page.goto(`/suministro/pagos/${encodeURIComponent(reference)}`, {
      waitUntil: "domcontentloaded"
    });
    await expect(
      page.getByRole("heading", { name: "Pago claro, pedido protegido." })
    ).toBeVisible();
    await expect(
      page.locator('[data-method="mercado-pago"]').getByText(/pasarela/u)
    ).toBeVisible();
    await expect(page.getByText("$3,000.00").first()).toBeVisible();
    expect(consoleErrors).toEqual([]);

    await page.setViewportSize({ height: 844, width: 390 });
    await page.reload({ waitUntil: "domcontentloaded" });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
    await database.customerAccount.delete({ where: { id: account.id } });
    await database.product.delete({ where: { id: product.id } });
  }
});
