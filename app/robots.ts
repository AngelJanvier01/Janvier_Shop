import type { MetadataRoute } from "next";

import { absoluteUrl, getSiteUrl, searchIndexingIsEnabled } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!searchIndexingIsEnabled()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/propuesta/",
        "/suministro/acceso",
        "/suministro/carrito",
        "/suministro/mi-cuenta",
        "/suministro/pagos/",
        "/suministro/registro"
      ]
    },
    host: getSiteUrl().origin,
    sitemap: absoluteUrl("/sitemap.xml")
  };
}
