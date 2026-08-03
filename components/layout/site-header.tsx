import Link from "next/link";

import { BrandMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

import { MobileNavigation } from "./mobile-navigation";
import { primaryNavigation, whatsappUrl } from "./navigation";
import styles from "./site-header.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link aria-label="Ir al inicio de JANVIER" className={styles.brand} href="/">
          <BrandMark className={styles.brandMark} />
          <span>JANVIER</span>
        </Link>

        <nav aria-label="Navegación principal" className={styles.desktopNav}>
          {primaryNavigation.map((item) => (
            <Link
              data-analytics={`NAV_${item.label.toUpperCase()}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className={styles.actions}>
          <Link
            className={styles.contactLink}
            data-analytics="NAV_CONTACTO"
            href="/contacto"
          >
            Contacto
          </Link>
          <a
            className={styles.projectLink}
            data-analytics="HEADER_WHATSAPP"
            href={whatsappUrl}
            rel="noreferrer"
            target="_blank"
          >
            Iniciar proyecto
          </a>
          <div className={styles.desktopTheme}>
            <ThemeToggle />
          </div>
          <MobileNavigation />
        </div>
      </div>
    </header>
  );
}
