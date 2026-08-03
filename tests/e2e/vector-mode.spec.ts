import { expect, test, type Page } from "@playwright/test";

async function waitForLock(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => document.pointerLockElement === document.documentElement)
    )
    .toBe(true);
  await expect(page.locator("html")).toHaveAttribute("data-vector-mode", "active");
}

async function waitForRelease(page: Page) {
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement === null))
    .toBe(true);
  await expect(page.locator("html")).not.toHaveAttribute("data-vector-mode", "active");
}

async function releaseWithNativeEscape(page: Page) {
  await page.keyboard.press("Escape");

  // Chromium does not route CDP-generated Escape presses through its native
  // Pointer Lock release handler in headless mode. Real browser Escape uses
  // that handler; this fallback verifies the identical pointerlockchange path.
  const remainedLocked = await page
    .waitForFunction(() => document.pointerLockElement === null, undefined, {
      timeout: 300
    })
    .then(() => false)
    .catch(() => true);
  if (remainedLocked) {
    await page.evaluate(() => document.exitPointerLock());
  }

  await waitForRelease(page);
}

test("VECTOR_MODE_84 requiere un gesto, queda en viewport y Escape restaura el cursor", async ({
  browser
}) => {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const activate = page.getByTestId("vector-mode-activate");
  await expect(activate).toHaveCount(1);
  await expect(page.locator("html")).not.toHaveAttribute("data-vector-mode", "active");
  await expect
    .poll(() => page.evaluate(() => document.pointerLockElement === null))
    .toBe(true);
  await page.mouse.move(200, 180);
  await expect
    .poll(() =>
      page.getByTestId("passive-vector-cursor").evaluate((element) => {
        return window.getComputedStyle(element).opacity;
      })
    )
    .toBe("0.62");
  await expect
    .poll(() => page.evaluate(() => window.getComputedStyle(document.body).cursor))
    .not.toBe("none");

  await page.evaluate(() => {
    const target = document.createElement("button");
    target.id = "vector-mode-test-target";
    target.dataset.cursorTarget = "";
    target.textContent = "VECTOR_TEST_TARGET";
    target.style.cssText = [
      "position:fixed",
      "z-index:80",
      "left:calc(50% - 5rem)",
      "top:calc(50% - 1.25rem)",
      "width:10rem",
      "height:2.5rem"
    ].join(";");
    target.addEventListener("click", () => {
      target.dataset.activated = String(Number(target.dataset.activated ?? "0") + 1);
    });
    document.body.append(target);
  });

  await activate.click();
  await waitForLock(page);
  await expect(page.getByTestId("vector-mode-exit")).toBeVisible();

  await expect(page.getByTestId("vector-mode")).toHaveAttribute(
    "data-cursor-state",
    "target"
  );

  // CDP does not reliably emit native mouse buttons after Pointer Lock in
  // headless Chromium. Dispatch the same document event consumed by the app;
  // movement and lock state above still exercise the browser integration.
  await page.evaluate(() => {
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
  await expect(page.locator("#vector-mode-test-target")).toHaveAttribute(
    "data-activated",
    "1"
  );

  await page.mouse.move(5000, 5000);
  const virtualPosition = await page.getByTestId("vector-cursor").evaluate((element) => {
    const transform = (element as HTMLElement).style.transform;
    const match = /translate3d\((-?[\d.]+)px,\s*(-?[\d.]+)px/.exec(transform);
    return {
      x: match ? Number(match[1]) : Number.NaN,
      y: match ? Number(match[2]) : Number.NaN,
      width: window.innerWidth,
      height: window.innerHeight
    };
  });
  expect(virtualPosition.x).toBeGreaterThanOrEqual(0);
  expect(virtualPosition.x).toBeLessThan(virtualPosition.width);
  expect(virtualPosition.y).toBeGreaterThanOrEqual(0);
  expect(virtualPosition.y).toBeLessThan(virtualPosition.height);

  await releaseWithNativeEscape(page);
  await expect
    .poll(() => page.evaluate(() => window.getComputedStyle(document.body).cursor))
    .not.toBe("none");

  expect(consoleProblems).toEqual([]);
  await context.close();
});

test("VECTOR_MODE_84 tolera 30 ciclos y limpia el estado al perder foco", async ({
  browser
}) => {
  test.setTimeout(120000);
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 720 }
  });
  await context.addInitScript(() => {
    let lockedElement: Element | null = null;

    Object.defineProperty(document, "pointerLockElement", {
      configurable: true,
      get: () => lockedElement
    });
    Object.defineProperty(HTMLElement.prototype, "requestPointerLock", {
      configurable: true,
      value: function requestPointerLock() {
        lockedElement = document.documentElement;
        document.dispatchEvent(new Event("pointerlockchange"));
        return Promise.resolve();
      }
    });
    Object.defineProperty(document, "exitPointerLock", {
      configurable: true,
      value: () => {
        lockedElement = null;
        document.dispatchEvent(new Event("pointerlockchange"));
      }
    });
  });
  const page = await context.newPage();
  const consoleProblems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });
  const activate = page.getByTestId("vector-mode-activate");
  await expect(activate).toHaveCount(1);

  for (let index = 0; index < 30; index += 1) {
    await activate.click();
    await waitForLock(page);
    await page.getByTestId("vector-mode-exit").click();
    await waitForRelease(page);
  }

  await activate.click();
  await waitForLock(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await waitForRelease(page);
  await expect
    .poll(() => page.evaluate(() => window.getComputedStyle(document.body).cursor))
    .not.toBe("none");

  expect(consoleProblems).toEqual([]);
  await context.close();
});

test("VECTOR_MODE_84 no se muestra con táctil ni reduced motion", async ({ browser }) => {
  const touchContext = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 }
  });
  const touchPage = await touchContext.newPage();
  await touchPage.goto("/", { waitUntil: "networkidle" });
  await expect(touchPage.getByTestId("vector-mode")).toHaveCount(0);
  await touchContext.close();

  const reducedContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 720 }
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto("/", { waitUntil: "networkidle" });
  await expect(reducedPage.getByTestId("vector-mode")).toHaveCount(0);
  await reducedContext.close();
});
