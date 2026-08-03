import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";
  const publicRoutes = [
    "",
    "/estudio",
    "/soluciones",
    "/proyectos",
    "/suministro",
    "/suministro/catalogo",
    "/laboratorio",
    "/acerca",
    "/contacto",
    "/diagnostico"
  ];

  return publicRoutes.map((route) => ({
    changeFrequency: route === "" ? "weekly" : "monthly",
    lastModified: new Date(),
    priority: route === "" ? 1 : route === "/diagnostico" ? 0.9 : 0.8,
    url: new URL(route || "/", siteUrl).toString()
  }));
}
