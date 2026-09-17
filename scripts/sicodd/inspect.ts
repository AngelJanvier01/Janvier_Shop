import "dotenv/config";

import { createSicoddClient } from "../../lib/sicodd/client";

function extractLinks(html: string) {
  return [...html.matchAll(/href="([^"]+)"/gi)]
    .map((match) => match[1])
    .filter((href): href is string => Boolean(href && !href.startsWith("#")))
    .filter((href) => href.startsWith("/admin"))
    .sort();
}

const client = createSicoddClient();
await client.signIn();
const dashboard = await client.getHtml("/admin");

console.log(
  JSON.stringify(
    {
      dashboardUrl: dashboard.url,
      links: [...new Set(extractLinks(dashboard.html))]
    },
    null,
    2
  )
);
