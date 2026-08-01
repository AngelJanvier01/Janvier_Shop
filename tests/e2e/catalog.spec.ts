import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { database } from "../../lib/database";

const runCatalogE2E = process.env.CATALOG_E2E === "1";
const runId = randomBytes(5).toString("hex");
let productId: string | undefined;
let productSlug: string | undefined;

test.describe("Catalogo tecnico", () => {
  test.skip(!runCatalogE2E, "Requiere una base local efimera de catalogo.");

  test.beforeAll(async () => {
    const owner = await database.adminUser.findFirst({
      where: { isActive: true },
      select: { id: true }
    });
    if (!owner) {
      throw new Error("CATALOG_E2E requires an initialized admin user.");
    }
    const product = await database.product.create({
      data: {
        brand: "QA Systems",
        category: "QA Catalogo",
        createdById: owner.id,
        description:
          "Ficha temporal para verificar filtros, solicitud y una vista tecnica sin precio publico.",
        name: `Nodo de prueba ${runId}`,
        sku: `QA-${runId}`.toUpperCase(),
        slug: `nodo-de-prueba-${runId}`,
        specialOrder: true,
        specifications: { items: ["16 GB RAM", "SSD 512 GB"] },
        status: "PUBLISHED"
      }
    });
    productId = product.id;
    productSlug = product.slug;
  });

  test.afterAll(async () => {
    if (productId) {
      await database.product.delete({ where: { id: productId } });
    }
  });

  test("filtra una ficha y prepara una solicitud sin mostrar precio", async ({
    page
  }) => {
    if (!productSlug) {
      throw new Error("Catalog fixture is unavailable.");
    }
    await page.goto(`/suministro/catalogo?q=${encodeURIComponent(runId)}`, {
      waitUntil: "networkidle"
    });
    await expect(
      page.getByRole("heading", { name: `Nodo de prueba ${runId}` })
    ).toBeVisible();
    await expect(page.getByText("RESULTADOS / 1")).toBeVisible();

    await page.goto(`/suministro/catalogo/${productSlug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("16 GB RAM")).toBeVisible();
    await expect(page.getByText("Segun volumen, vigencia y condiciones")).toBeVisible();
    const requestLink = page.getByRole("link", { name: "Solicitar este producto" });
    await expect(requestLink).toHaveAttribute("href", /wa\.me\/5214923940983/);
    await expect(requestLink).toHaveAttribute("href", /SKU%20QA-/);
    await expect(page.getByText("MXN")).toHaveCount(0);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
