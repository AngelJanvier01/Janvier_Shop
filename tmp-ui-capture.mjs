import { chromium } from "playwright";
import { config } from "dotenv";

config({ path: ".env" });

const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });

await page.goto("http://127.0.0.1:3001/suministro/catalogo", {
  waitUntil: "networkidle"
});
await page.screenshot({
  fullPage: true,
  path: "C:/Users/ANGEL/AppData/Local/Temp/janvier-public-before.png"
});
await page.screenshot({
  fullPage: false,
  path: "C:/Users/ANGEL/AppData/Local/Temp/janvier-public-before-viewport.png"
});

await page.request.post("http://127.0.0.1:3001/api/admin/auth/login", {
  data: {
    email: process.env.INITIAL_ADMIN_EMAIL,
    password: process.env.INITIAL_ADMIN_PASSWORD
  }
});
await page.goto("http://127.0.0.1:3001/admin/catalogo", { waitUntil: "networkidle" });
await page.screenshot({
  fullPage: true,
  path: "C:/Users/ANGEL/AppData/Local/Temp/janvier-admin-before.png"
});
await page.screenshot({
  fullPage: false,
  path: "C:/Users/ANGEL/AppData/Local/Temp/janvier-admin-before-viewport.png"
});

await browser.close();
