import type { MetadataRoute } from "next";

import { database } from "@/lib/database";
import { absoluteUrl, searchIndexingIsEnabled } from "@/lib/seo";

export const dynamic = "force-dynamic";

const publicRoutes: Array<{
  changeFrequency: "daily" | "weekly" | "monthly" | "yearly";
  path: string;
  priority: number;
}> = [
  { changeFrequency: "weekly", path: "/", priority: 1 },
  { changeFrequency: "monthly", path: "/estudio", priority: 0.9 },
  { changeFrequency: "monthly", path: "/soluciones", priority: 0.9 },
  { changeFrequency: "weekly", path: "/proyectos", priority: 0.8 },
  { changeFrequency: "monthly", path: "/suministro", priority: 0.9 },
  { changeFrequency: "daily", path: "/suministro/catalogo", priority: 0.9 },
  { changeFrequency: "monthly", path: "/laboratorio", priority: 0.7 },
  { changeFrequency: "yearly", path: "/acerca", priority: 0.7 },
  { changeFrequency: "yearly", path: "/contacto", priority: 0.8 },
  { changeFrequency: "monthly", path: "/diagnostico", priority: 0.9 },
  { changeFrequency: "monthly", path: "/aplicacion", priority: 0.6 },
  { changeFrequency: "yearly", path: "/privacidad", priority: 0.3 },
  { changeFrequency: "yearly", path: "/terminos", priority: 0.3 }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!searchIndexingIsEnabled()) return [];

  const staticEntries: MetadataRoute.Sitemap = publicRoutes.map((route) => ({
    changeFrequency: route.changeFrequency,
    priority: route.priority,
    url: absoluteUrl(route.path)
  }));

  try {
    const [projects, products] = await Promise.all([
      database.project.findMany({
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
        where: { isPublic: true }
      }),
      database.product.findMany({
        orderBy: { updatedAt: "desc" },
        select: { slug: true, updatedAt: true },
        where: { status: "PUBLISHED" }
      })
    ]);

    return [
      ...staticEntries,
      ...projects.map((project) => ({
        changeFrequency: "monthly" as const,
        lastModified: project.updatedAt,
        priority: 0.7,
        url: absoluteUrl(`/proyectos/${project.slug}`)
      })),
      ...products.map((product) => ({
        changeFrequency: "weekly" as const,
        lastModified: product.updatedAt,
        priority: 0.6,
        url: absoluteUrl(`/suministro/catalogo/${product.slug}`)
      }))
    ];
  } catch {
    return staticEntries;
  }
}
