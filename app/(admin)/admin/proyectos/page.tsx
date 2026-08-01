import Link from "next/link";

import { ProjectCreateForm } from "@/components/admin/project-create-form";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Proyectos"
};

export default async function AdminProjectsPage() {
  const projects = await database.project.findMany({
    include: { client: true },
    orderBy: { updatedAt: "desc" },
    take: 30
  });

  return (
    <section className={styles.page}>
      <p>PROJECT_LOG / PORTFOLIO_CONTROL</p>
      <h1>Proyectos</h1>
      <ProjectCreateForm />
      {projects.length ? (
        <div className={styles.list}>
          {projects.map((project) => (
            <article key={project.id}>
              <div>
                <span>{project.isPublic ? "PUBLICO" : "PRIVADO"}</span>
                <h2>{project.title}</h2>
              </div>
              <p>{project.client.companyName ?? project.client.contactName}</p>
              <b>{project.status}</b>
              {project.isPublic ? (
                <Link href={`/proyectos/${project.slug}`}>Ver caso</Link>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>Aun no hay casos publicados.</h2>
          <p>El portafolio solo muestra trabajo real con autorizacion clara.</p>
        </section>
      )}
    </section>
  );
}
