import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { adminSessionCookieName, createAdminSession } from "../../lib/auth/admin-session";
import { database } from "../../lib/database";

test("an administrator can compare the processed image with the supplier source", async ({
  browser
}) => {
  const suffix = randomBytes(5).toString("hex");
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true }
  });
  const sourceImage = `data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="black"/><circle cx="60" cy="60" r="32" fill="orange"/></svg>'
  )}`;
  const product = await database.product.create({
    data: {
      category: "PRUEBAS",
      createdById: owner.id,
      description:
        "Ficha temporal para validar la comparación de imágenes administrativas.",
      galleryUrls: [sourceImage],
      imageDerivatives: {
        create: {
          processingVersion: 3,
          sourcePosition: 0,
          sourceUrl: sourceImage,
          sourceUrlHash: "c".repeat(64),
          status: "APPROVED",
          storageKey: `qa-image-review-${suffix}`
        }
      },
      imageUrl: sourceImage,
      name: `IMAGEN DE REVISIÓN ${suffix}`,
      sku: `QA-IMAGE-${suffix}`.toUpperCase(),
      slug: `imagen-de-revision-${suffix}`,
      status: "PUBLISHED"
    },
    select: { id: true, imageDerivatives: { select: { id: true } } }
  });
  const session = await createAdminSession(owner.id);
  const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
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
    await page.goto(`/admin/catalogo?q=${encodeURIComponent(`QA-IMAGE-${suffix}`)}`, {
      waitUntil: "domcontentloaded"
    });
    const productRow = page.locator(`#catalog-product-${product.id}`);
    await expect(productRow).toBeVisible();

    await productRow.getByRole("button", { name: "REVISAR IMÁGENES" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("PROCESADA JANVIER")).toBeVisible();
    await expect(dialog.getByText("ORIGINAL DEL PROVEEDOR")).toBeVisible();
    await expect(
      dialog.getByRole("img", {
        name: `Imagen procesada de IMAGEN DE REVISIÓN ${suffix}`
      })
    ).toHaveAttribute(
      "src",
      `/api/product-images/${product.imageDerivatives[0]!.id}/webp?v=3`
    );

    await dialog.getByRole("button", { name: "ORIGINAL DEL PROVEEDOR" }).click();
    await expect(
      dialog.getByRole("img", {
        name: `Imagen original del proveedor de IMAGEN DE REVISIÓN ${suffix}`
      })
    ).toHaveAttribute("src", sourceImage);

    await dialog.getByRole("button", { name: "Cerrar visor de imágenes" }).click();
    await expect(dialog).toBeHidden();
  } finally {
    await context.close();
    await database.product.delete({ where: { id: product.id } });
  }
});
