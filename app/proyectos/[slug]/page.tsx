import { notFound } from "next/navigation";

import { InformationPage } from "@/components/marketing/information-page";
import { database } from "@/lib/database";

type PublicProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

export default async function PublicProjectPage({ params }: PublicProjectPageProps) {
  const { slug } = await params;
  const project = await database.project.findFirst({
    where: { isPublic: true, slug },
    select: { summary: true, title: true }
  });
  if (!project) {
    notFound();
  }

  return (
    <InformationPage
      closing="Si tu operacion necesita un caso bien resuelto, conversemos."
      label="PROJECT_LOG / AUTHORIZED_CASE"
      lede={project.summary ?? "Caso autorizado para documentar el trabajo de JANVIER."}
      sections={[
        {
          title: "El contexto importa.",
          copy:
            project.summary ??
            "Este caso esta publicado con el nivel de detalle autorizado por el cliente."
        },
        {
          title: "Documentar tambien es entregar.",
          copy: "Cada proyecto publicado por JANVIER se presenta con criterio y sin exponer informacion que el cliente no autorizo."
        }
      ]}
      title={project.title}
      titleSize="medium"
    />
  );
}
