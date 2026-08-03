const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3002";
const parsedUrl = new URL(baseUrl);

process.env.HOSTNAME = parsedUrl.hostname;
process.env.PORT = parsedUrl.port || (parsedUrl.protocol === "https:" ? "443" : "80");

await import("./start-standalone.mjs");
