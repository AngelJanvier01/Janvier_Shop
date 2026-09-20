import { expect, test } from "@playwright/test";

import "dotenv/config";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";

test("records product intent without exposing anonymous visitors", async ({
  browser
}) => {
  const suffix = `${Date.now()}-${Math.round(Math.random() * 10_000)}`;
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true }
  });
  const product = await database.product.create({
    data: {
      brand: "JANVIER QA",
      category: "PRUEBAS",
      createdById: owner.id,
      description:
        "Producto temporal para verificar las señales comerciales de catálogo.",
      galleryUrls: [
        "https://placehold.co/600x600/png?text=QA+A",
        "https://placehold.co/600x600/png?text=QA+B"
      ],
      imageDerivatives: {
        create: [
          {
            sourcePosition: 0,
            sourceUrl: "https://placehold.co/600x600/png?text=QA+A",
            sourceUrlHash: "a".repeat(64),
            status: "APPROVED",
            storageKey: "qa-product-engagement-a"
          },
          {
            sourcePosition: 1,
            sourceUrl: "https://placehold.co/600x600/png?text=QA+B",
            sourceUrlHash: "b".repeat(64),
            status: "APPROVED",
            storageKey: "qa-product-engagement-b"
          }
        ]
      },
      imageUrl: "https://placehold.co/600x600/png?text=QA+A",
      name: "PRODUCTO DE PRUEBA DE SEÑALES",
      sku: `QA-ENG-${suffix}`,
      slug: `qa-engagement-${suffix}`,
      status: "PUBLISHED"
    },
    select: { id: true, slug: true }
  });
  const customerContext = await browser.newContext({
    viewport: { height: 900, width: 1440 }
  });
  const customerPage = await customerContext.newPage();

  try {
    await customerPage.goto(`/suministro/catalogo/${product.slug}`, {
      waitUntil: "domcontentloaded"
    });
    await expect(
      customerPage.getByRole("heading", { name: "PRODUCTO DE PRUEBA DE SEÑALES" })
    ).toBeVisible();
    await expect
      .poll(() =>
        database.productEngagementEvent.count({
          where: { eventType: "PRODUCT_VIEW", productId: product.id }
        })
      )
      .toBe(1);

    await customerPage.locator('button[aria-label="Mostrar imagen 2"]').click();
    await expect
      .poll(() =>
        database.productEngagementEvent.count({
          where: { eventType: "GALLERY_COMPLETED", productId: product.id }
        })
      )
      .toBe(1);

    const sessionOnly = await database.productEngagementEvent.findFirstOrThrow({
      select: { accountId: true, customerUserId: true, sessionHash: true },
      where: { eventType: "PRODUCT_VIEW", productId: product.id }
    });
    expect(sessionOnly.accountId).toBeNull();
    expect(sessionOnly.customerUserId).toBeNull();
    expect(sessionOnly.sessionHash).toHaveLength(64);

    const adminSession = await createAdminSession(owner.id);
    const adminContext = await browser.newContext({
      viewport: { height: 900, width: 1440 }
    });
    await adminContext.addCookies([
      {
        domain: new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001")
          .hostname,
        name: adminSessionCookieName,
        path: "/",
        value: adminSession.token
      }
    ]);
    const adminPage = await adminContext.newPage();
    try {
      await adminPage.goto(`/admin/analitica?product=${product.id}`, {
        waitUntil: "domcontentloaded"
      });
      await expect(adminPage.getByTestId("product-engagement-report")).toBeVisible();
      await expect(
        adminPage.getByRole("heading", { name: "PRODUCTO DE PRUEBA DE SEÑALES" })
      ).toBeVisible();
      await expect(adminPage.getByText("SESIONES ÚNICAS")).toBeVisible();
      await expect(
        adminPage.getByText("Personas identificadas que interactuaron")
      ).toBeVisible();
    } finally {
      await adminContext.close();
    }
  } finally {
    await customerContext.close();
    await database.product.delete({ where: { id: product.id } });
  }
});
