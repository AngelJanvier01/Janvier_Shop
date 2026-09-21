import type { Metadata } from "next";

export const siteName = "JANVIER";
export const siteDescription =
  "Software, consultoría, infraestructura y suministro tecnológico desde Zacatecas, México.";

const fallbackSiteUrl = "http://localhost:3001";

export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  try {
    return new URL(configured || fallbackSiteUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export function absoluteUrl(path = "/") {
  return new URL(path, getSiteUrl()).toString();
}

export function searchIndexingIsEnabled() {
  const siteUrl = getSiteUrl();
  if (process.env.PLAYWRIGHT_MODE === "production") return true;
  return (
    process.env.NODE_ENV === "production" &&
    process.env.SEARCH_INDEXING_DISABLED !== "true" &&
    siteUrl.protocol === "https:" &&
    !["localhost", "127.0.0.1", "[::1]"].includes(siteUrl.hostname)
  );
}

type PageMetadataInput = {
  description: string;
  images?: string[];
  path: string;
  title: string;
  type?: "website" | "article";
};

export function createPageMetadata({
  description,
  images = ["/opengraph-image"],
  path,
  title,
  type = "website"
}: PageMetadataInput): Metadata {
  const socialTitle = `${title} — ${siteName}`;
  return {
    alternates: { canonical: path },
    description,
    openGraph: {
      description,
      images,
      locale: "es_MX",
      siteName,
      title: socialTitle,
      type,
      url: path
    },
    title,
    twitter: {
      card: "summary_large_image",
      description,
      images,
      title: socialTitle
    }
  };
}
