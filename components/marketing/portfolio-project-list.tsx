import Link from "next/link";

import styles from "./portfolio-project-list.module.css";

type PortfolioProjectListProps = {
  projects: Array<{
    slug: string;
    summary: string | null;
    title: string;
  }>;
};

export function PortfolioProjectList({ projects }: PortfolioProjectListProps) {
  if (!projects.length) {
    return null;
  }

  return (
    <section className={styles.section} aria-labelledby="published-projects-title">
      <div className={styles.heading}>
        <p>CASOS PUBLICADOS / EVIDENCIA</p>
        <h2 id="published-projects-title">Trabajo real, contado con contexto.</h2>
      </div>
      <div className={styles.list}>
        {projects.map((project, index) => (
          <Link href={`/proyectos/${project.slug}`} key={project.slug}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div>
              <h3>{project.title}</h3>
              {project.summary ? <p>{project.summary}</p> : null}
            </div>
            <b>VER CASO →</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
