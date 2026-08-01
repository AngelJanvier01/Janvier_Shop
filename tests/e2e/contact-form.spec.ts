import { expect, test } from "@playwright/test";

test("Contacto prepara un mensaje completo sin almacenar ni enviar datos", async ({
  browser
}) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript(() => {
    Object.assign(window, {
      __janvierOpenedUrl: ""
    });
    Object.defineProperty(window, "open", {
      configurable: true,
      value: (url: string) => {
        Object.assign(window, { __janvierOpenedUrl: url });
        return null;
      }
    });
  });
  const page = await context.newPage();

  await page.goto("/contacto", { waitUntil: "networkidle" });
  await expect(page.getByTestId("contact-form-section")).toBeVisible();
  await expect(page.getByTestId("vector-mode")).toHaveCount(0);

  const form = page.getByTestId("contact-form");
  await form.getByLabel("NOMBRE / REQUIRED").fill("Andrea Rivera");
  await form.getByLabel("ORGANIZACIÓN").fill("Operación Norte");
  await form.getByLabel("CORREO / REQUIRED").fill("andrea@example.test");
  await form.getByLabel("TELÉFONO").fill("5550102030");
  await form.getByLabel("ÁREA DE INTERÉS / REQUIRED").selectOption({
    label: "Software y automatización"
  });
  await form.getByLabel("HORIZONTE").selectOption({ label: "Este trimestre" });
  await form
    .getByLabel("CONTEXTO / REQUIRED")
    .fill("Necesitamos reducir errores de captura en el equipo operativo.");

  const submit = form.getByRole("button", {
    name: "Preparar mensaje en WhatsApp"
  });
  await expect(submit).toHaveCount(1);
  await submit.click();

  await expect(page.getByTestId("contact-form-status")).toHaveText(
    "Abrimos WhatsApp con tu resumen listo para enviar."
  );
  const fallback = form.getByRole("link", { name: "Abrir WhatsApp de nuevo" });
  await expect(fallback).toHaveCount(1);

  const preparedRequest = await page.evaluate(() => {
    const openedUrl = (window as typeof window & { __janvierOpenedUrl: string })
      .__janvierOpenedUrl;
    const url = new URL(openedUrl);
    return { host: url.hostname, message: url.searchParams.get("text") };
  });
  expect(preparedRequest.host).toBe("wa.me");
  expect(preparedRequest.message).toContain("Nombre: Andrea Rivera");
  expect(preparedRequest.message).toContain("Operación Norte");
  expect(preparedRequest.message).toContain("Software y automatización");
  expect(preparedRequest.message).toContain("reducir errores de captura");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);

  await context.close();
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
