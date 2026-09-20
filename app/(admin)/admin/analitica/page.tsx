import { ProductEngagementReport } from "@/components/admin/product-engagement-report";
import { WebAnalyticsReport } from "@/components/admin/web-analytics-report";
import { getProductEngagementReport } from "@/lib/analytics/product-engagement-report";
import { getWebAnalyticsReport } from "@/lib/analytics/report";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Analítica"
};

type AdminAnalyticsPageProps = {
  searchParams: Promise<{ product?: string }>;
};

export default async function AdminAnalyticsPage({
  searchParams
}: AdminAnalyticsPageProps) {
  const params = await searchParams;
  const productId = params.product?.match(/^c[a-z0-9]{8,}$/i)?.[0];
  const [report, productReport] = await Promise.all([
    getWebAnalyticsReport(),
    getProductEngagementReport({ productId })
  ]);

  return (
    <section className={styles.page}>
      <p>ANALYTICS / FIRST_PARTY_MEASUREMENT</p>
      <h1>Señales de la web.</h1>
      <p className={styles.lede}>
        Lo que las personas exploran y los siguientes pasos que intentan tomar, sin
        perfiles invasivos ni proveedores externos.
      </p>
      <WebAnalyticsReport report={report} />
      <ProductEngagementReport report={productReport} />
    </section>
  );
}
