import Link from "next/link";

import { BrandLockup } from "@/components/brand/logo";
import { AnalyticsPreferencesButton } from "@/components/analytics/analytics-preferences-button";
import { AsciiArtifact } from "@/components/ui/ascii-artifact";

import { primaryNavigation, whatsappUrl } from "./navigation";
import styles from "./site-footer.module.css";

export function SiteFooter() {
  const hasThirdPartyAnalytics = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim()
  );

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <BrandLockup className={styles.lockup} />
          <p>Software, consultoría y suministro tecnológico con atención directa.</p>
        </div>
        <nav aria-label="Navegación secundaria" className={styles.navigation}>
          {primaryNavigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <Link href="/contacto">Contacto</Link>
          <Link data-testid="footer-privacy" href="/privacidad">
            Privacidad
          </Link>
          <Link data-testid="footer-terms" href="/terminos">
            Términos
          </Link>
        </nav>
        <div className={styles.meta}>
          <p>ZACATECAS_MX / TRABAJO_REMOTO</p>
          <a href={whatsappUrl} rel="noreferrer" target="_blank">
            WhatsApp
          </a>
          <Link
            className={styles.adminAccess}
            data-testid="footer-admin-access"
            href="/admin/acceso"
          >
            ACCESO_ADMIN
          </Link>
          {hasThirdPartyAnalytics ? (
            <AnalyticsPreferencesButton className={styles.analyticsPreferences} />
          ) : null}
          <span>© {new Date().getFullYear()} JANVIER</span>
        </div>
      </div>
      <AsciiArtifact className={styles.footerAscii} variant="signal" />
    </footer>
  );
}
