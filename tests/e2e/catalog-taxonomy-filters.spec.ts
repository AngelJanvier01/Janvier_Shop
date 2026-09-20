import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { database } from "../../lib/database";

test("narrows brand options to the selected category and subcategory", async ({
  page
}) => {
  const suffix = randomBytes(5).toString("hex").toUpperCase();
  const category = `QA MONITORES ${suffix}`;
  const ledBrand = `QA LED ${suffix}`;
  const cameraBrand = `QA CÁMARAS ${suffix}`;
  const unrelatedBrand = `QA SANDISK ${suffix}`;
  const family = await database.sicoddCatalogFamily.create({
    data: {
      code: `QF${suffix}`,
      lastSeenAt: new Date(),
      name: `QA FAMILIA ${suffix}`
    },
    select: { id: true }
  });
  const [ledSubcategory, cameraSubcategory, storageSubcategory] = await Promise.all([
    database.sicoddCatalogSubcategory.create({
      data: {
        code: `QL${suffix}`,
        familyId: family.id,
        lastSeenAt: new Date(),
        name: `QA MONITORES LED ${suffix}`
      },
      select: { id: true, code: true }
    }),
    database.sicoddCatalogSubcategory.create({
      data: {
        code: `QC${suffix}`,
        familyId: family.id,
        lastSeenAt: new Date(),
        name: `QA MONITORES CÁMARA ${suffix}`
      },
      select: { id: true, code: true }
    }),
    database.sicoddCatalogSubcategory.create({
      data: {
        code: `QS${suffix}`,
        familyId: family.id,
        lastSeenAt: new Date(),
        name: `QA ALMACENAMIENTO ${suffix}`
      },
      select: { id: true, code: true }
    })
  ]);
  const owner = await database.adminUser.findFirstOrThrow({
    select: { id: true },
    where: { isActive: true }
  });
  const products = await Promise.all([
    database.product.create({
      data: {
        brand: ledBrand,
        category,
        createdById: owner.id,
        description:
          "Producto temporal para probar las facetas dependientes de taxonomía.",
        name: `MONITOR LED ${suffix}`,
        sku: `QA-LED-${suffix}`,
        slug: `qa-led-${suffix.toLowerCase()}`,
        status: "PUBLISHED",
        supplierSubcategoryId: ledSubcategory.id
      },
      select: { id: true }
    }),
    database.product.create({
      data: {
        brand: cameraBrand,
        category,
        createdById: owner.id,
        description:
          "Producto temporal para probar las facetas dependientes de taxonomía.",
        name: `MONITOR CON CÁMARA ${suffix}`,
        sku: `QA-CAM-${suffix}`,
        slug: `qa-cam-${suffix.toLowerCase()}`,
        status: "PUBLISHED",
        supplierSubcategoryId: cameraSubcategory.id
      },
      select: { id: true }
    }),
    database.product.create({
      data: {
        brand: unrelatedBrand,
        category: `QA ALMACENAMIENTO ${suffix}`,
        createdById: owner.id,
        description:
          "Producto temporal para probar las facetas dependientes de taxonomía.",
        name: `UNIDAD DE ALMACENAMIENTO ${suffix}`,
        sku: `QA-SSD-${suffix}`,
        slug: `qa-ssd-${suffix.toLowerCase()}`,
        status: "PUBLISHED",
        supplierSubcategoryId: storageSubcategory.id
      },
      select: { id: true }
    })
  ]);

  try {
    await page.goto(
      `/suministro/catalogo?category=${encodeURIComponent(category)}&brand=${encodeURIComponent(
        cameraBrand
      )}`,
      { waitUntil: "networkidle" }
    );
    const filterPanel = page.getByRole("complementary", { name: "Filtros del catálogo" });
    const brandSelect = filterPanel.getByLabel("MARCA");
    await expect(brandSelect).toHaveValue(cameraBrand);
    await expect(brandSelect.locator("option").filter({ hasText: ledBrand })).toHaveCount(
      1
    );
    await expect(
      brandSelect.locator("option").filter({ hasText: cameraBrand })
    ).toHaveCount(1);
    await expect(
      brandSelect.locator("option").filter({ hasText: unrelatedBrand })
    ).toHaveCount(0);

    await Promise.all([
      page.waitForURL(
        (url) =>
          url.searchParams.get("category") === category &&
          url.searchParams.get("subcategory") === ledSubcategory.code &&
          !url.searchParams.has("brand")
      ),
      page.getByLabel("SUBCATEGORÍAS DETECTADAS").selectOption(ledSubcategory.code)
    ]);

    await expect(brandSelect).toHaveValue("");
    await expect(brandSelect.locator("option").filter({ hasText: ledBrand })).toHaveCount(
      1
    );
    await expect(
      brandSelect.locator("option").filter({ hasText: cameraBrand })
    ).toHaveCount(0);
    await expect(
      brandSelect.locator("option").filter({ hasText: unrelatedBrand })
    ).toHaveCount(0);
  } finally {
    await database.product.deleteMany({
      where: { id: { in: products.map((product) => product.id) } }
    });
    await database.sicoddCatalogFamily.deleteMany({ where: { id: family.id } });
  }
});
