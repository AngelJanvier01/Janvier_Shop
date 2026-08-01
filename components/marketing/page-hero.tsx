import Image, { type StaticImageData } from "next/image";

import { AsciiArtifact } from "@/components/ui/ascii-artifact";

import styles from "./page-hero.module.css";

export type PageHeroTitleSize = "short" | "medium" | "long";

type PageHeroProps = {
  label: string;
  title: string;
  description: string;
  titleSize?: PageHeroTitleSize;
  visualImage?: StaticImageData;
  visualImageAlt?: string;
};

export function PageHero({
  label,
  title,
  description,
  titleSize = "medium",
  visualImage,
  visualImageAlt = ""
}: PageHeroProps) {
  return (
    <section aria-labelledby="page-title" className={styles.hero} data-testid="page-hero">
      <div className={styles.inner}>
        <div className={styles.content}>
          <p className={styles.label}>{label}</p>
          <div className={styles.titleMask}>
            <h1 className={styles.title} data-size={titleSize} id="page-title">
              {title}
            </h1>
          </div>
          <p className={styles.description}>{description}</p>
        </div>

        <div
          aria-hidden={visualImage ? undefined : true}
          className={styles.visual}
          data-has-image={visualImage ? "true" : undefined}
        >
          {visualImage ? (
            <Image
              alt={visualImageAlt}
              className={styles.visualImage}
              fill
              priority
              sizes="(max-width: 64rem) 100vw, 45vw"
              src={visualImage}
            />
          ) : null}
          <div aria-hidden="true" className={styles.grid} />
          <div aria-hidden="true" className={styles.signal} />
          <div aria-hidden="true" className={styles.reticle} />
          <AsciiArtifact className={styles.visualAscii} variant="telemetry" />
          <div aria-hidden="true" className={styles.readout}>
            <span>JANVIER / PAGE_MODULE</span>
            <span className={styles.status}>
              <i />
              SYSTEM_READY
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
