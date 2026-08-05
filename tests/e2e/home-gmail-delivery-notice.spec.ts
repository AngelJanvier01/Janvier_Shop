import { expect, test, type Page } from "@playwright/test";

const deliveryNotice =
  "JANVIER organiza las solicitudes, los diagnósticos, los proyectos y las propuestas de cada colaboración. En las áreas privadas, las personas involucradas pueden revisar una propuesta, dar seguimiento a las decisiones y retomar el trabajo sin perder el hilo.";

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
  test(`la explicación de JANVIER y Google es visible y usable en ${name}`, async ({
    browser
  }) => {
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
    await expect(notice).toContainText(
      "La conexión se usa sólo para esas notificaciones transaccionales. JANVIER no entra a la bandeja de entrada: no lee, busca, modifica ni elimina los mensajes de la cuenta conectada."
    );
    await expect(notice).toContainText("PERMISO UTILIZADO / GMAIL.SEND");
    await expect(notice.getByRole("heading")).toHaveText(
      "De una solicitud a una decisión."
    );
    await assertNoHorizontalOverflow(page);

    await expect(notice.getByRole("link", { name: "Privacidad" })).toHaveAttribute(
      "href",
      "/privacidad"
    );
    await expect(notice.getByRole("link", { name: "Términos de uso" })).toHaveAttribute(
      "href",
      "/terminos"
    );
    await notice.getByRole("link", { name: "Privacidad" }).click();
    await expect(page).toHaveURL(/\/privacidad$/);
    await expect(page.getByTestId("legal-document")).toBeVisible();
    expect(consoleErrors).toEqual([]);

    await context.close();
  });
}
