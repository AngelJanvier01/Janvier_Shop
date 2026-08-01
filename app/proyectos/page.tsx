import { InformationPage } from "@/components/marketing/information-page";
import { PortfolioProjectList } from "@/components/marketing/portfolio-project-list";
import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await database.project.findMany({
    where: { isPublic: true },
    orderBy: { updatedAt: "desc" },
    select: { slug: true, summary: true, title: true }
  });

  return (
    <InformationPage
      closing="Tu proyecto puede ser el proximo caso bien contado."
      label="PROJECT_LOG / CONTEXT_REQUIRED"
      lede="Cada caso de JANVIER se publica con contexto, evidencia y el nivel de confidencialidad que su cliente autorice."
      titleSize="medium"
      sections={[
        {
          title: "No habra relleno.",
          copy: "El portafolio esta preparado para mostrar problema, estrategia, implementacion, resultados, tecnologias y metricas. Se publica cuando el trabajo y la autorizacion existen."
        },
        {
          title: "Privacidad por proyecto",
          copy: "Un caso puede ser anonimo, parcial, autorizado o personalizado. El nombre, logotipo, metricas y enlaces externos nunca se asumen.",
          items: ["ANONIMO", "PARCIAL", "AUTORIZADO", "PERSONALIZADO"]
        },
        {
          title: "Una estructura que explica",
          copy: "La pagina final de cada proyecto muestra lo necesario para entender la necesidad, el criterio y el resultado; no solo una captura bonita."
        }
      ]}
      title="El trabajo merece mas que una galeria."
    >
      <PortfolioProjectList projects={projects} />
    </InformationPage>
  );
}
