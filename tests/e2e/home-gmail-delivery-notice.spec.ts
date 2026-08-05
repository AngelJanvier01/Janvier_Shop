import { expect, test, type Page } from "@playwright/test";

const deliveryNotice =
  "JANVIER es una plataforma para gestionar solicitudes, proyectos y propuestas privadas. Su panel administrativo puede conectar una cuenta Google para enviar notificaciones transaccionales autorizadas mediante Gmail API. JANVIER no lee, busca ni modifica el correo de la cuenta conectada.";

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

for (const [name, viewport] of [
  ["desktop", { height: 900, width: 1440 }],
  ["mobile", { height: 844, width: 390 }]
] as const) {
  test(`la nota de Gmail API es visible y usable en ${name}`, async ({ browser }) => {
    const context = await browser.newContext({
      hasTouch: name === "mobile",
      isMobile: name === "mobile",
      viewport
    });
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });
    const notice = page.getByTestId("home-gmail-delivery-notice");
    await notice.scrollIntoViewIfNeeded();

    await expect(notice).toBeVisible();
    await expect(notice).toContainText(deliveryNotice);
    await expect(notice.getByRole("heading")).toHaveText(
      "Notificaciones con límites claros."
    );
    await assertNoHorizontalOverflow(page);

    await notice.getByRole("link", { name: "Conocer el aviso de privacidad" }).click();
    await expect(page).toHaveURL(/\/privacidad$/);
    await expect(page.getByTestId("legal-document")).toBeVisible();
    expect(consoleErrors).toEqual([]);

    await context.close();
  });
}
