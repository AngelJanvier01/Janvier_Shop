import "dotenv/config";

const keyPattern = /^[A-Za-z0-9-]{8,128}$/;

function configuredOrigin() {
  const value = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!value) throw new Error("Falta NEXT_PUBLIC_SITE_URL.");
  const url = new URL(value);
  if (url.protocol !== "https:") {
    throw new Error("IndexNow requiere NEXT_PUBLIC_SITE_URL con HTTPS.");
  }
  return url.origin;
}

function requestedUrls(origin: string) {
  const args = process.argv.slice(2);
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--url") {
      const value = args[index + 1];
      if (!value) throw new Error("Cada --url necesita una ruta o URL.");
      values.push(value);
      index += 1;
    } else {
      values.push(args[index]);
    }
  }
  if (!values.length) {
    throw new Error(
      "Indica al menos una URL: npm run seo:indexnow -- --url /ruta"
    );
  }

  return [...new Set(values.map((value) => new URL(value, origin).toString()))].map(
    (value) => {
      const url = new URL(value);
      if (url.origin !== origin) {
        throw new Error(`La URL no pertenece al sitio configurado: ${value}`);
      }
      return url.toString();
    }
  );
}

async function main() {
  const origin = configuredOrigin();
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !keyPattern.test(key)) {
    throw new Error("INDEXNOW_KEY debe tener entre 8 y 128 letras, números o guiones.");
  }
  const urlList = requestedUrls(origin);
  const endpoint = process.env.INDEXNOW_ENDPOINT?.trim() || "https://api.indexnow.org/indexnow";
  const response = await fetch(endpoint, {
    body: JSON.stringify({
      host: new URL(origin).host,
      key,
      keyLocation: `${origin}/api/indexnow/key`,
      urlList
    }),
    headers: { "content-type": "application/json; charset=utf-8" },
    method: "POST"
  });
  if (![200, 202].includes(response.status)) {
    throw new Error(`IndexNow respondió con HTTP ${response.status}.`);
  }
  console.log(`IndexNow aceptó ${urlList.length} URL(s).`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "No se pudo notificar IndexNow.");
  process.exitCode = 1;
});
