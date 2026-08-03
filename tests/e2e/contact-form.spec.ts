import { randomBytes } from "node:crypto";

import "dotenv/config";
import { expect, test } from "@playwright/test";

import { database } from "../../lib/database";

test("Contacto registra un diagnóstico privado y prepara el siguiente paso", async ({
  browser
}) => {
  const email = `contacto-${randomBytes(5).toString("hex")}@example.test`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto("/contacto", { waitUntil: "networkidle" });
    await expect(page.getByTestId("contact-form-section")).toBeVisible();
    await expect(page.getByTestId("vector-mode")).toHaveCount(0);

    const form = page.getByTestId("contact-form");
    await form.getByLabel("NOMBRE / REQUIRED").fill("Andrea Rivera");
    await form.getByLabel("ORGANIZACIÓN").fill("Operación Norte");
    await form.getByLabel("CORREO / REQUIRED").fill(email);
    await form.getByLabel("TELÉFONO").fill("5550102030");
    await form.getByLabel("ÁREA DE INTERÉS / REQUIRED").selectOption({
      label: "Software y automatización"
    });
    await form.getByLabel("HORIZONTE").selectOption({ label: "Este trimestre" });
    await form.getByLabel("INVERSIÓN ESTIMADA").selectOption({
      label: "$25,000 a $75,000 MXN"
    });
    await form
      .getByLabel("CONTEXTO / REQUIRED")
      .fill("Necesitamos reducir errores de captura en el equipo operativo.");

    await form.getByRole("button", { name: "Solicitar diagnóstico" }).click();
    await expect(page.getByTestId("contact-form-status")).toHaveText(
      "Solicitud registrada. Puedes continuar por WhatsApp para acelerar la conversación."
    );
    const fallback = form.getByRole("link", { name: "Continuar por WhatsApp" });
    await expect(fallback).toHaveAttribute("href", /wa\.me/);
    await expect(fallback).toHaveAttribute("href", /Software%20y%20automatizaci/);

    await expect
      .poll(() =>
        database.diagnosticRequest.findFirst({
          where: { email },
          select: { budgetRange: true, companyName: true, service: true, status: true }
        })
      )
      .toMatchObject({
        budgetRange: "$25,000 a $75,000 MXN",
        companyName: "Operación Norte",
        service: "Software y automatización",
        status: "NEW"
      });

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  } finally {
    await database.diagnosticRequest.deleteMany({ where: { email } });
    await context.close();
  }
});

test("Contacto mantiene el formulario contenido en móvil y en ambos temas", async ({
  browser
}) => {
  const context = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { height: 844, width: 390 }
  });
  const page = await context.newPage();

  await page.goto("/contacto", { waitUntil: "networkidle" });
  await expect(page.getByTestId("contact-form")).toBeVisible();
  await expect(page.getByTestId("vector-mode")).toHaveCount(0);

  for (const theme of ["neutral", "night"]) {
    await page.evaluate((nextTheme) => {
      window.localStorage.setItem("janvier-theme", nextTheme);
      document.documentElement.dataset.theme = nextTheme;
    }, theme);

    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
  }

  await context.close();
});
