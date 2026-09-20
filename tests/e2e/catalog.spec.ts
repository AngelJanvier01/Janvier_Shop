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
      select: { id: true },
      where: { isActive: true }
    });
    if (!owner) throw new Error("CATALOG_E2E requires an initialized admin user.");
    const product = await database.product.create({
      data: {
        brand: "QA Systems",
        category: "QA Catalogo",
        createdById: owner.id,
        description: "Ficha temporal para verificar filtros y un carrito de visitante.",
        name: `Nodo de prueba ${runId}`,
        sku: `QA-${runId}`.toUpperCase(),
        slug: `nodo-de-prueba-${runId}`,
        specialOrder: true,
        specifications: [
          { label: "MEMORIA", value: "16 GB RAM" },
          { label: "ALMACENAMIENTO", value: "SSD 512 GB" }
        ],
        status: "PUBLISHED"
      }
    });
    productId = product.id;
    productSlug = product.slug;
  });

  test.afterAll(async () => {
    if (productId) await database.product.delete({ where: { id: productId } });
  });

  test("filtra, ordena y permite conservar un producto antes de iniciar sesion", async ({
    page
  }) => {
    if (!productSlug) throw new Error("Catalog fixture is unavailable.");
    await page.setViewportSize({ height: 1200, width: 3440 });
    await page.goto(`/suministro/catalogo?q=${encodeURIComponent(runId)}`, {
      waitUntil: "networkidle"
    });
    await expect(
      page.getByRole("heading", { name: `Nodo de prueba ${runId}` })
    ).toBeVisible();
    await expect(page.getByText("RESULTADOS / 1")).toBeVisible();

    await Promise.all([
      page.waitForURL((url) => url.searchParams.get("sort") === "price-asc"),
      page.getByRole("combobox", { name: "ORDENAR" }).selectOption("price-asc")
    ]);
    await expect(
      page.getByRole("heading", { name: `Nodo de prueba ${runId}` })
    ).toBeVisible();

    await page.goto(`/suministro/catalogo/${productSlug}`, { waitUntil: "networkidle" });
    await expect(page.getByText("16 GB RAM")).toBeVisible();
    await expect(page.getByText(/Te ayudamos a elegir y confirmar/)).toBeVisible();
    await expect(page.getByRole("link", { name: "DESCARGAR PDF" })).toHaveAttribute(
      "href",
      `/api/catalog/products/${productSlug}/pdf`
    );
    await expect(
      page.getByRole("link", { name: "HABLAR CON UN ASESOR" })
    ).toHaveAttribute("href", "/contacto");
    await expect(page.getByRole("button", { name: "AGREGAR AL CARRITO" })).toBeVisible();
    await expect(page.getByRole("button", { name: /SOLICITAR MANUALES/ })).toBeVisible();
    await expect(page.getByText("MXN")).toHaveCount(0);

    await page.getByRole("button", { name: "AGREGAR AL CARRITO" }).click();
    await expect(page.getByText("PRODUCTO AGREGADO")).toBeVisible();
    await expect(page.getByRole("link", { name: "VER CARRITO" })).toBeVisible();
    const cartCounter = page
      .getByRole("navigation", { name: "Navegación de suministro" })
      .getByRole("link", { name: /CARRITO/ });
    await expect(cartCounter).toHaveText(/CARRITO\s*1/);

    await page.getByRole("button", { name: "AGREGAR OTRA PIEZA" }).click();
    await expect(cartCounter).toHaveText(/CARRITO\s*2/);

    await page.goto("/suministro/carrito", { waitUntil: "networkidle" });
    await expect(page.getByText("CARRITO TEMPORAL")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: `Nodo de prueba ${runId}` })
    ).toBeVisible();
    await expect(cartCounter).toHaveText(/CARRITO\s*2/);

    await page.getByRole("button", { name: `Restar Nodo de prueba ${runId}` }).click();
    await expect(cartCounter).toHaveText(/CARRITO\s*1/);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  });
});
