import Image, { type StaticImageData } from "next/image";

import { AsciiArtifact } from "@/components/ui/ascii-artifact";
import { AsciiAnimation } from "@/components/ui/ascii-animation";

import styles from "./page-hero.module.css";

export type PageHeroTitleSize = "short" | "medium" | "long";

export type PageHeroVisualModule = {
  label: string;
  title: string;
  stages: string[];
  signals: Array<{
    label: string;
    value: string;
  }>;
};

type PageHeroProps = {
  label: string;
  title: string;
  description: string;
  titleSize?: PageHeroTitleSize;
  visualImage?: StaticImageData;
  visualImageAlt?: string;
  visualModule?: PageHeroVisualModule;
};

export function PageHero({
  label,
  title,
  description,
  titleSize = "medium",
  visualImage,
  visualImageAlt = "",
  visualModule
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
          aria-hidden={visualImage || visualModule ? undefined : true}
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
          {visualModule ? <AsciiAnimation src="/ascii/operation-flow-v1.json" /> : null}
          <AsciiArtifact className={styles.visualAscii} variant="telemetry" />
          {visualModule ? (
            <section aria-label={visualModule.label} className={styles.module}>
              <header className={styles.moduleHeader}>
                <span>{visualModule.label}</span>
                <span>ACTIVE</span>
              </header>
              <h2>{visualModule.title}</h2>
              <ol className={styles.moduleStages}>
                {visualModule.stages.map((stage, index) => (
                  <li key={stage}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    {stage}
                  </li>
                ))}
              </ol>
              <dl className={styles.moduleSignals}>
                {visualModule.signals.map((signal) => (
                  <div key={signal.label}>
                    <dt>{signal.label}</dt>
                    <dd>{signal.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}
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
