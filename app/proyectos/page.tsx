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
      closing="¿Tienes un proyecto parecido? Hablemos."
      label="PROYECTOS / TRABAJO_SELECCIONADO"
      lede="Una selección de proyectos de JANVIER. Cada caso muestra qué se necesitaba, qué hicimos y cuál fue el resultado."
      titleSize="medium"
      visualModule={{
        label: "CASOS / TRABAJO_AUTORIZADO",
        title: "NECESIDAD / TRABAJO / RESULTADO",
        stages: ["Problema", "Implementación", "Resultado"],
        signals: [
          { label: "SELECCIÓN", value: "Proyectos publicados" },
          { label: "PRIVACIDAD", value: "Por cliente" }
        ]
      }}
      sections={[
        {
          title: "Lo importante del proyecto",
          copy: "Cada caso explica el problema, las decisiones técnicas y el resultado para que se entienda el trabajo realizado."
        },
        {
          title: "Reserva por proyecto",
          copy: "Sólo publicamos la información autorizada por el cliente. Algunos casos muestran la marca y otros se concentran en la parte técnica.",
          items: ["ANÓNIMO", "PARCIAL", "AUTORIZADO", "PERSONALIZADO"]
        },
        {
          title: "Información suficiente",
          copy: "La página de cada proyecto reúne los datos necesarios para entender la necesidad, el trabajo y el resultado."
        }
      ]}
      title="Proyectos y resultados."
    >
      <PortfolioProjectList projects={projects} />
    </InformationPage>
  );
}
