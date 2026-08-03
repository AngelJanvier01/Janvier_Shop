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
      closing="Hablemos de la operación que quieres mejorar."
      label="PROJECT_LOG / SELECTED_WORK"
      lede="Una selección de colaboraciones de JANVIER, presentada con el contexto y el nivel de reserva adecuado para cada caso."
      titleSize="medium"
      visualModule={{
        label: "CASE_LOG / AUTHORIZED_WORK",
        title: "RETO / CRITERIO / RESULTADO",
        stages: ["Contexto", "Decisión", "Resultado"],
        signals: [
          { label: "REGISTRO", value: "Seleccionado" },
          { label: "RESERVA", value: "Por proyecto" }
        ]
      }}
      sections={[
        {
          title: "Contexto antes que apariencia",
          copy: "Cada caso explica el reto, el criterio técnico y el resultado relevante para entender el trabajo realizado."
        },
        {
          title: "Reserva por proyecto",
          copy: "La información publicada se ajusta al alcance autorizado: puede presentar la marca, omitirla o concentrarse únicamente en el aprendizaje técnico.",
          items: ["ANONIMO", "PARCIAL", "AUTORIZADO", "PERSONALIZADO"]
        },
        {
          title: "Una lectura útil",
          copy: "La página de cada proyecto reúne lo necesario para comprender la necesidad, la solución y su resultado."
        }
      ]}
      title="Proyectos con contexto y resultado."
    >
      <PortfolioProjectList projects={projects} />
    </InformationPage>
  );
}
