import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeBootstrap } from "@/components/ui/theme-bootstrap";
import { WebAnalyticsTracker } from "@/components/analytics/web-analytics-tracker";
import { ThirdPartyAnalytics } from "@/components/analytics/third-party-analytics";
import {
  absoluteUrl,
  getSiteUrl,
  searchIndexingIsEnabled,
  siteDescription
} from "@/lib/seo";

import "../styles/globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  weight: ["400", "500", "600"]
});

const displayFont = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  variable: "--font-plex-display",
  weight: ["400", "500", "600"]
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"]
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "JANVIER — Software, consultoría y suministro",
    template: "%s — JANVIER"
  },
  description: siteDescription,
  applicationName: "JANVIER",
  authors: [{ name: "Angel Janvier" }],
  creator: "Angel Janvier",
  publisher: "JANVIER",
  category: "technology",
  formatDetection: { address: false, email: false, telephone: false },
  icons: {
    apple: [{ url: "/brand/angel_janvier_monogram_black_1600.png" }],
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      {
        url: "/brand/angel_janvier_monogram_black_1600.png",
        sizes: "1600x1600",
        type: "image/png"
      }
    ]
  },
  manifest: "/manifest.webmanifest",
  openGraph: {
    description: siteDescription,
    images: ["/opengraph-image"],
    locale: "es_MX",
    siteName: "JANVIER",
    title: "JANVIER — Software, consultoría y suministro",
    type: "website",
    url: "/"
  },
  robots: {
    index: searchIndexingIsEnabled(),
    follow: searchIndexingIsEnabled()
  },
  twitter: {
    card: "summary_large_image",
    description: siteDescription,
    images: ["/twitter-image"],
    title: "JANVIER — Software, consultoría y suministro"
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION
      ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION }
      : undefined
  }
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@id": `${absoluteUrl("/")}#organization`,
      "@type": ["Organization", "ProfessionalService"],
      areaServed: { "@type": "Country", name: "México" },
      description: siteDescription,
      founder: { "@id": `${absoluteUrl("/")}#angel-janvier` },
      name: "JANVIER",
      telephone: "+52 1 492 394 0983",
      url: absoluteUrl("/")
    },
    {
      "@id": `${absoluteUrl("/")}#angel-janvier`,
      "@type": "Person",
      jobTitle: "Fundador",
      name: "Angel Janvier",
      url: absoluteUrl("/acerca"),
      worksFor: { "@id": `${absoluteUrl("/")}#organization` }
    }
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="es" data-theme="neutral" suppressHydrationWarning>
      <head>
        <ThemeBootstrap />
      </head>
      <body
        className={[bodyFont.variable, displayFont.variable, monoFont.variable].join(" ")}
      >
        <script
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationJsonLd).replace(/</g, "\\u003c")
          }}
          type="application/ld+json"
        />
        {children}
        <WebAnalyticsTracker />
        <ThirdPartyAnalytics
          googleAnalyticsId={process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID}
          googleTagManagerId={process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID}
        />
      </body>
    </html>
  );
}
