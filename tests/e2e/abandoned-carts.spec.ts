import { expect, test } from "@playwright/test";

import "dotenv/config";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";

test("shows a real inactive commercial list and applies the recovery window", async ({
  browser
}) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true, role: { in: ["ADMIN", "OWNER"] } }
  });
  const account = await database.customerAccount.create({
    data: {
      companyName: `CUENTA QA ${suffix}`,
      contactName: "CLIENTE QA",
      status: "APPROVED",
      users: {
        create: {
          email: `qa-cart-${suffix}@example.test`,
          isActive: true,
          name: "CLIENTE QA"
        }
      }
    },
    select: { id: true }
  });
  const product = await database.product.create({
    data: {
      brand: "JANVIER QA",
      category: "PRUEBAS",
      createdById: owner.id,
      description: "Producto temporal para verificar recuperación de listas comerciales.",
      name: "PRODUCTO DE PRUEBA DE RECUPERACIÓN",
      sku: `QA-CART-${suffix}`,
      slug: `qa-cart-${suffix}`,
      status: "PUBLISHED"
    },
    select: { id: true }
  });
  const cart = await database.commerceCart.create({
    data: {
      accountId: account.id,
      items: { create: { productId: product.id, quantity: 2 } }
    },
    select: { id: true }
  });
  await database.commerceCart.update({
    data: { updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000) },
    where: { id: cart.id }
  });
  const adminSession = await createAdminSession(owner.id);
  const context = await browser.newContext({ viewport: { height: 900, width: 1440 } });
  await context.addCookies([
    {
      domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
        .hostname,
      name: adminSessionCookieName,
      path: "/",
      value: adminSession.token
    }
  ]);
  const page = await context.newPage();

  try {
    await page.goto("/admin/carritos-abandonados?age=2h", {
      waitUntil: "domcontentloaded"
    });
    await expect(page.getByRole("heading", { name: "Carritos en pausa." })).toBeVisible();
    await expect(page.getByText(`CUENTA QA ${suffix}`)).toBeVisible();
    await expect(page.getByText("PRODUCTO DE PRUEBA DE RECUPERACIÓN")).toBeVisible();
    await expect(page.locator('select[name="status"]').first()).toHaveValue("OPEN");

    await page.locator('article select[name="status"]').selectOption("CONTACTED");
    await page
      .locator('article input[name="adminNotes"]')
      .fill("QA: seguimiento preparado");
    await page.getByRole("button", { name: "GUARDAR" }).click();
    await expect(page.locator('article select[name="status"]')).toHaveValue("CONTACTED");
    await expect(page.locator('article input[name="adminNotes"]')).toHaveValue(
      "QA: seguimiento preparado"
    );

    await page.locator('select[name="age"]').selectOption("7d");
    await page.getByRole("button", { name: "ACTUALIZAR" }).click();
    await expect(page.getByRole("heading", { name: "Bandeja despejada." })).toBeVisible();

    await page.setViewportSize({ height: 844, width: 390 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth)
    ).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
    await database.commerceCart.delete({ where: { id: cart.id } });
    await database.customerAccount.delete({ where: { id: account.id } });
    await database.product.delete({ where: { id: product.id } });
  }
});
