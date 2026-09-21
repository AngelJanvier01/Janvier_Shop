import dns from "node:dns/promises";
import tls from "node:tls";

const configuredUrl = process.env.SMOKE_BASE_URL ?? "https://jaanviieer.com";
const site = new URL(configuredUrl);
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS ?? "15000", 10);
const supplierUrl = new URL(
  process.env.SMOKE_SUPPLIER_URL ?? "https://janvier01.sicodd.com.mx"
);
const failures = [];
let homepage = "";
let sitemap = "";

if (site.protocol !== "https:" || site.pathname !== "/") {
  throw new Error("SMOKE_BASE_URL debe ser un origen HTTPS sin ruta.");
}

async function request(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      "user-agent": "JANVIER-Production-Smoke/1.0",
      ...options.headers
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
}

function absolute(path) {
  return new URL(path, site).toString();
}

async function check(name, task) {
  try {
    const detail = await task();
    process.stdout.write(`OK   ${name}${detail ? ` — ${detail}` : ""}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${name}: ${message}`);
    process.stderr.write(`FAIL ${name} — ${message}\n`);
  }
}

function requireStatus(response, expected = 200) {
  if (response.status !== expected) {
    throw new Error(`HTTP ${response.status}; se esperaba ${expected}`);
  }
}

function requireHeader(response, name, pattern) {
  const value = response.headers.get(name) ?? "";
  if (!pattern.test(value)) throw new Error(`falta o es inválido ${name}`);
}

async function checkTlsSocket(host, port) {
  await new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("tiempo de espera agotado"));
    }, timeoutMs);
    socket.once("secureConnect", () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

await check("DNS público", async () => {
  const addresses = await dns.lookup(site.hostname, { all: true });
  if (!addresses.length) throw new Error("el dominio no resolvió");
  return `${addresses.length} dirección(es)`;
});

await check("HTTP redirige a HTTPS", async () => {
  const insecure = new URL(site);
  insecure.protocol = "http:";
  const response = await request(insecure, { redirect: "manual" });
  if (![301, 302, 307, 308].includes(response.status)) {
    throw new Error(`HTTP ${response.status}; se esperaba una redirección`);
  }
  const location = new URL(response.headers.get("location") ?? "", insecure);
  if (location.protocol !== "https:" || location.hostname !== site.hostname) {
    throw new Error("la redirección no apunta al dominio HTTPS canónico");
  }
  return `HTTP ${response.status}`;
});

if (!site.hostname.startsWith("www.")) {
  await check("www redirige al dominio canónico", async () => {
    const www = new URL(site);
    www.hostname = `www.${site.hostname}`;
    const response = await request(www, { redirect: "manual" });
    if (![301, 302, 307, 308].includes(response.status)) {
      throw new Error(`HTTP ${response.status}; se esperaba una redirección`);
    }
    const location = new URL(response.headers.get("location") ?? "", www);
    if (location.origin !== site.origin) {
      throw new Error("www no apunta al origen canónico");
    }
    return `HTTP ${response.status}`;
  });
}

await check("Homepage HTTPS", async () => {
  const response = await request(site);
  requireStatus(response);
  requireHeader(response, "content-type", /text\/html/i);
  requireHeader(response, "strict-transport-security", /max-age=/i);
  requireHeader(response, "content-security-policy", /default-src/i);
  requireHeader(response, "x-content-type-options", /nosniff/i);
  homepage = await response.text();
  if (!homepage.includes("JANVIER")) throw new Error("no contiene la identidad JANVIER");
  return "200 + cabeceras de seguridad";
});

await check("Canonical y JSON-LD", async () => {
  if (!homepage) throw new Error("la portada no pudo analizarse");
  const escapedOrigin = site.origin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["']${escapedOrigin}/?["']`, "i").test(homepage)) {
    throw new Error("canonical ausente o incorrecto");
  }
  const jsonLd = [...homepage.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!jsonLd.length) throw new Error("no se encontró JSON-LD");
  for (const match of jsonLd) JSON.parse(match[1]);
  return `${jsonLd.length} bloque(s) válido(s)`;
});

await check("API y base de datos", async () => {
  const response = await request(absolute("/api/health"), { cache: "no-store" });
  requireStatus(response);
  const payload = await response.json();
  if (payload?.status !== "ok" || payload?.service !== "janvier-v2") {
    throw new Error("respuesta de salud inesperada");
  }
  return "status=ok";
});

await check("robots.txt", async () => {
  const response = await request(absolute("/robots.txt"));
  requireStatus(response);
  const body = await response.text();
  if (!body.includes(`Sitemap: ${absolute("/sitemap.xml")}`)) {
    throw new Error("no referencia el sitemap canónico");
  }
  if (/Disallow:\s*\/\s*$/m.test(body)) throw new Error("bloquea todo el sitio");
});

await check("sitemap.xml", async () => {
  const response = await request(absolute("/sitemap.xml"));
  requireStatus(response);
  requireHeader(response, "content-type", /xml/i);
  sitemap = await response.text();
  if (!sitemap.includes(`<loc>${site.origin}/</loc>`)) {
    throw new Error("no contiene la portada canónica");
  }
  if (/\/admin(?:\/|&lt;|<)/i.test(sitemap)) throw new Error("incluye rutas administrativas");
});

await check("Manifest", async () => {
  const response = await request(absolute("/manifest.webmanifest"));
  requireStatus(response);
  const manifest = await response.json();
  if (manifest?.name !== "JANVIER" || manifest?.lang !== "es-MX") {
    throw new Error("contenido inesperado");
  }
});

for (const [name, path] of [
  ["Imagen Open Graph", "/opengraph-image"],
  ["Favicon", "/favicon.ico"],
  ["Logotipo", "/brand/angel_janvier_logo_black.svg"]
]) {
  await check(name, async () => {
    const response = await request(absolute(path));
    requireStatus(response);
    requireHeader(response, "content-type", /image/i);
    const bytes = (await response.arrayBuffer()).byteLength;
    if (bytes < 256) throw new Error("archivo vacío o incompleto");
    return `${bytes} bytes`;
  });
}

await check("Formulario de contacto", async () => {
  const response = await request(absolute("/contacto"));
  requireStatus(response);
  const body = await response.text();
  for (const field of ["contactName", "email", "service", "message"]) {
    if (!body.includes(`name="${field}"`)) throw new Error(`falta el campo ${field}`);
  }
  if (!/<form[\s>]/i.test(body)) throw new Error("no se encontró el formulario");
  return "renderizado sin enviar datos";
});

await check("Página 404", async () => {
  const response = await request(absolute(`/__janvier_smoke_missing_${Date.now()}`));
  requireStatus(response, 404);
});

await check("Conectividad con Mercado Pago", async () => {
  const response = await request("https://api.mercadopago.com", { redirect: "manual" });
  if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  return `HTTP ${response.status}`;
});

await check("Conectividad con SICODD", async () => {
  const response = await request(supplierUrl, { redirect: "manual" });
  if (response.status >= 500) throw new Error(`HTTP ${response.status}`);
  return `HTTP ${response.status}`;
});

await check("Conectividad TLS con Gmail SMTP", async () => {
  await checkTlsSocket("smtp.gmail.com", 465);
  return "TLS 465";
});

if (failures.length) {
  process.stderr.write(`\n${failures.length} comprobación(es) fallaron:\n`);
  for (const failure of failures) process.stderr.write(`- ${failure}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write("\nSmoke test de producción completado sin errores.\n");
}
