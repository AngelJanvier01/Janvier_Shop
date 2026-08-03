import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import type { ReactNode } from "react";

import { ThemeBootstrap } from "@/components/ui/theme-bootstrap";
import { VectorMode } from "@/components/ui/vector-mode";
import { WebAnalyticsTracker } from "@/components/analytics/web-analytics-tracker";

import "../styles/globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001";

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
  metadataBase: new URL(siteUrl),
  title: {
    default: "JANVIER — Tecnología para lo que sigue.",
    template: "%s — JANVIER"
  },
  description: "Software, ingeniería, consultoría y suministro para personas y empresas.",
  applicationName: "JANVIER",
  robots: {
    index: true,
    follow: true
  }
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
        {children}
        <WebAnalyticsTracker />
        <VectorMode />
      </body>
    </html>
  );
}
