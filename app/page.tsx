import type { Metadata } from "next";

import { HomePage } from "@/components/marketing/home-page";
import { createPageMetadata, siteDescription } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description: siteDescription,
  path: "/",
  title: "Software, consultoría y suministro tecnológico"
});

export default function Page() {
  return <HomePage />;
}
