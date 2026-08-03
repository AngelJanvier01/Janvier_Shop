import { WebAnalyticsReport } from "@/components/admin/web-analytics-report";
import { getWebAnalyticsReport } from "@/lib/analytics/report";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Analítica"
};

export default async function AdminAnalyticsPage() {
  const report = await getWebAnalyticsReport();

  return (
    <section className={styles.page}>
      <p>ANALYTICS / FIRST_PARTY_MEASUREMENT</p>
      <h1>Señales de la web.</h1>
      <p className={styles.lede}>
        Lo que las personas exploran y los siguientes pasos que intentan tomar, sin
        perfiles invasivos ni proveedores externos.
      </p>
      <WebAnalyticsReport report={report} />
    </section>
  );
}
