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
      closing="¿Necesitas resolver algo parecido? Hablemos."
      label="PROYECTO / CASO_AUTORIZADO"
      lede={project.summary ?? "Proyecto publicado con autorización del cliente."}
      sections={[
        {
          title: "La necesidad",
          copy:
            project.summary ??
            "Este caso está publicado con el nivel de detalle autorizado por el cliente."
        },
        {
          title: "Información autorizada",
          copy: "La publicación explica el trabajo sin mostrar información que el cliente no autorizó."
        }
      ]}
      title={project.title}
      titleSize="medium"
    />
  );
}
