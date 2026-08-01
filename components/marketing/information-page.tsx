import Link from "next/link";
import type { StaticImageData } from "next/image";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { whatsappUrl } from "@/components/layout/navigation";
import { AsciiArtifact } from "@/components/ui/ascii-artifact";

import { PageHero, type PageHeroTitleSize } from "./page-hero";
import styles from "./information-page.module.css";

type InformationSection = {
  id?: string;
  title: string;
  copy: string;
  items?: string[];
};

type InformationPageProps = {
  label: string;
  title: string;
  titleSize: PageHeroTitleSize;
  lede: string;
  sections: InformationSection[];
  closing: string;
  visualImage?: StaticImageData;
  visualImageAlt?: string;
};

export function InformationPage({
  label,
  title,
  titleSize,
  lede,
  sections,
  closing,
  visualImage,
  visualImageAlt
}: InformationPageProps) {
  return (
    <>
      <SiteHeader />
      <main>
        <PageHero
          description={lede}
          label={label}
          title={title}
          titleSize={titleSize}
          visualImage={visualImage}
          visualImageAlt={visualImageAlt}
        />

        <section className={styles.content} aria-label="Contenido principal">
          {sections.map((section, index) => (
            <article className={styles.section} id={section.id} key={section.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{section.title}</h2>
                <p>{section.copy}</p>
                {section.items ? (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </article>
          ))}
          <AsciiArtifact className={styles.contentAscii} variant="calibration" />
        </section>

        <section className={styles.closing} aria-labelledby="closing-title">
          <p>OPEN_CONVERSATION</p>
          <h2 id="closing-title">{closing}</h2>
          <div>
            <a href={whatsappUrl} rel="noreferrer" target="_blank">
              Hablar por WhatsApp
            </a>
            <Link href="/">Volver al inicio</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
