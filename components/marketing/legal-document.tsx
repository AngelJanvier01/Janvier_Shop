import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

import styles from "./legal-document.module.css";

export type LegalSection = {
  content: ReactNode;
  id: string;
  title: string;
  featured?: boolean;
};

type LegalDocumentProps = {
  description: string;
  sections: LegalSection[];
  title: string;
};

const updatedAt = "5 de agosto de 2026";

export function LegalDocument({ description, sections, title }: LegalDocumentProps) {
  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <div className={styles.document} data-copy-allowed data-testid="legal-document">
          <header className={styles.hero}>
            <p>LEGAL_DOCUMENT</p>
            <h1>{title}</h1>
            <p className={styles.description}>{description}</p>
            <p className={styles.updated}>
              Última actualización <time dateTime="2026-08-05">{updatedAt}</time>
            </p>
          </header>

          <div className={styles.readingLayout}>
            <nav
              aria-label="Índice del documento"
              className={styles.tableOfContents}
              data-testid="legal-table-of-contents"
            >
              <p>ÍNDICE</p>
              <ol>
                {sections.map((section, index) => (
                  <li key={section.id}>
                    <Link href={`#${section.id}`}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      {section.title}
                    </Link>
                  </li>
                ))}
              </ol>
            </nav>

            <div className={styles.sections}>
              {sections.map((section, index) => (
                <section
                  className={section.featured ? styles.featuredSection : styles.section}
                  id={section.id}
                  key={section.id}
                >
                  <p aria-hidden="true" className={styles.sectionNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </p>
                  <div>
                    <h2>{section.title}</h2>
                    <div className={styles.sectionContent}>{section.content}</div>
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
