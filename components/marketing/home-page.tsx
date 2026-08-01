import Image from "next/image";
import Link from "next/link";

import founderPortrait from "@/FOTO JANVIER.png";
import { BrandMark } from "@/components/brand/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { whatsappUrl } from "@/components/layout/navigation";
import { AsciiArtifact } from "@/components/ui/ascii-artifact";

import styles from "./home-page.module.css";

const intentions = [
  {
    number: "01",
    title: "Desarrollar",
    copy: "Necesito software, automatización o una plataforma.",
    href: "/estudio"
  },
  {
    number: "02",
    title: "Resolver",
    copy: "Necesito diagnóstico, consultoría o una estrategia.",
    href: "/soluciones"
  },
  {
    number: "03",
    title: "Equipar",
    copy: "Necesito productos, infraestructura o compra por volumen.",
    href: "/suministro"
  },
  {
    number: "04",
    title: "Mantener",
    copy: "Necesito soporte, seguimiento o mejora continua.",
    href: "/estudio#soporte"
  }
];

const capabilities = [
  [
    "01",
    "Desarrollo de software",
    "Sistemas, portales, APIs, dashboards y automatización."
  ],
  ["02", "Consultoría tecnológica", "Criterio para decidir, priorizar y reducir riesgo."],
  ["03", "Desarrollo web", "Experiencias digitales que se conectan con la operación."],
  ["04", "Soporte y mantenimiento", "Seguimiento técnico después de la entrega."]
];

export function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroContent}>
            <p className={styles.technicalLabel}>JANVIER_01 / INDEPENDENT TECHNOLOGY</p>
            <h1 id="hero-title">
              Tecnología
              <br />
              para lo que sigue.
            </h1>
            <p className={styles.heroCopy}>
              Software, ingeniería, consultoría y suministro para personas y empresas.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryAction} href="/estudio">
                Explorar capacidades
              </Link>
              <a
                className={styles.secondaryAction}
                href={whatsappUrl}
                rel="noreferrer"
                target="_blank"
              >
                Iniciar un proyecto
              </a>
            </div>
            <dl className={styles.heroMeta}>
              <div>
                <dt>CAPABILITIES</dt>
                <dd>SOFTWARE / CONSULTING / SUPPLY / SUPPORT</dd>
              </div>
              <div>
                <dt>OPERATING FROM</dt>
                <dd>MONTERREY_MX / REMOTE_WORLDWIDE</dd>
              </div>
              <div>
                <dt>STATUS</dt>
                <dd>AVAILABLE_FOR_THE_RIGHT_PROBLEM</dd>
              </div>
            </dl>
          </div>
          <div
            aria-hidden="true"
            className={styles.heroArtwork}
            data-testid="index-hero-monogram-panel"
          >
            <div className={styles.artworkGrid} />
            <div className={styles.artworkLine} />
            <div
              className={styles.indexHeroMonogramFrame}
              data-testid="index-hero-monogram"
            >
              <BrandMark
                className={styles.indexHeroMonogram}
                label=""
                testId="index-hero-monogram-svg"
              />
            </div>
            <div className={styles.systemReadout}>
              <span>25.6866°N / 100.3161°W</span>
              <span className={styles.systemState}>
                <i />
                SYSTEM_NOMINAL
              </span>
            </div>
            <AsciiArtifact className={styles.ascii} variant="signal" />
          </div>
        </section>

        <section className={styles.intentions} aria-labelledby="intentions-title">
          <div className={styles.sectionHeading}>
            <p className={styles.technicalLabel}>START_WITH_INTENTION</p>
            <h2 id="intentions-title">¿Qué necesitas mover?</h2>
          </div>
          <div className={styles.intentionGrid}>
            {intentions.map((item) => (
              <Link className={styles.intentionCard} href={item.href} key={item.number}>
                <span>{item.number}</span>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
                <b aria-hidden="true">↗</b>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.capabilities} aria-labelledby="capabilities-title">
          <div className={styles.sectionHeading}>
            <p className={styles.technicalLabel}>CORE_CAPABILITIES</p>
            <h2 id="capabilities-title">Diseñamos, integramos y hacemos que funcione.</h2>
          </div>
          <div className={styles.capabilityList}>
            {capabilities.map(([number, title, copy]) => (
              <article className={styles.capability} key={number}>
                <span>{number}</span>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.founder} aria-labelledby="founder-title">
          <div className={styles.founderLabel}>
            <Image
              alt="Ángel Janvier, fundador de JANVIER"
              className={styles.founderPhoto}
              fill
              sizes="(max-width: 48rem) calc(100vw - 2rem), 40vw"
              src={founderPortrait}
            />
            <BrandMark className={styles.founderMark} label="" />
            <p>HUMAN_RESPONSIBILITY_INCLUDED</p>
          </div>
          <div className={styles.founderCopy}>
            <p className={styles.technicalLabel}>UNA PERSONA REAL</p>
            <h2 id="founder-title">Detrás de cada solución.</h2>
            <p>
              Soy Ángel Janvier. Puedo diagnosticar el problema, diseñar la solución y
              acompañarte hasta que todo esté funcionando.
            </p>
            <div className={styles.inlineActions}>
              <Link href="/acerca">Conocer a Ángel</Link>
              <a href={whatsappUrl} rel="noreferrer" target="_blank">
                Solicitar diagnóstico
              </a>
            </div>
          </div>
        </section>

        <section className={styles.projects} aria-labelledby="projects-title">
          <div className={styles.sectionHeading}>
            <p className={styles.technicalLabel}>PROJECT_LOG / VERIFIABLE_WORK</p>
            <h2 id="projects-title">El trabajo merece contexto.</h2>
          </div>
          <div className={styles.projectMessage}>
            <span>PROJECTS_LOADING</span>
            <p>
              Los casos se publicarán con resultados y el nivel de confidencialidad que
              cada cliente autorice. No habrá proyectos inventados para llenar una
              cuadrícula.
            </p>
            <Link href="/proyectos">Cómo documentamos los proyectos</Link>
          </div>
        </section>

        <section className={styles.supply} aria-labelledby="supply-title">
          <div>
            <p className={styles.technicalLabel}>SPECIALIZED_SUPPLY</p>
            <h2 id="supply-title">
              Desde equipo cotidiano hasta infraestructura crítica.
            </h2>
          </div>
          <div className={styles.supplyCopy}>
            <p>
              Compras individuales, mayoreo, proyectos y solicitudes especiales. Validamos
              disponibilidad y condiciones antes de cobrar.
            </p>
            <div className={styles.inlineActions}>
              <Link href="/suministro">Explorar suministro</Link>
              <a href={whatsappUrl} rel="noreferrer" target="_blank">
                Solicitar abastecimiento
              </a>
            </div>
          </div>
        </section>

        <section className={styles.lab} aria-labelledby="lab-title">
          <div className={styles.labCode} aria-hidden="true">
            <span>TOOLS</span>
            <span>QR</span>
            <span>STORAGE</span>
            <span>BANDWIDTH</span>
            <span>UPS</span>
          </div>
          <div>
            <p className={styles.technicalLabel}>JANVIER_LAB</p>
            <h2 id="lab-title">Herramientas que resuelven algo antes de pedirte algo.</h2>
            <p>
              Calculadoras, generadores y recursos técnicos construidos para aportar valor
              real.
            </p>
            <Link href="/laboratorio">Explorar el laboratorio</Link>
          </div>
        </section>

        <section className={styles.conversation} aria-labelledby="conversation-title">
          <p className={styles.technicalLabel}>NEXT_STEP / OPEN_CONVERSATION</p>
          <h2 id="conversation-title">¿Qué estás tratando de construir?</h2>
          <p>No necesitas llegar con la solución resuelta. Cuéntame el problema.</p>
          <a
            className={styles.primaryAction}
            href={whatsappUrl}
            rel="noreferrer"
            target="_blank"
          >
            Iniciar conversación
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
