import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { InformationPage } from "@/components/marketing/information-page";
import { database } from "@/lib/database";
import { absoluteUrl, createPageMetadata } from "@/lib/seo";

type PublicProjectPageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamic = "force-dynamic";

const getPublicProject = cache((slug: string) =>
  database.project.findFirst({
    where: { isPublic: true, slug },
    select: { summary: true, title: true, updatedAt: true }
  })
);

export async function generateMetadata({
  params
}: PublicProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) {
    return { robots: { follow: false, index: false }, title: "Proyecto no encontrado" };
  }
  return createPageMetadata({
    description:
      project.summary ??
      "Proyecto de JANVIER publicado con el nivel de detalle autorizado por el cliente.",
    path: `/proyectos/${slug}`,
    title: project.title,
    type: "article"
  });
}

export default async function PublicProjectPage({ params }: PublicProjectPageProps) {
  const { slug } = await params;
  const project = await getPublicProject(slug);
  if (!project) {
    notFound();
  }

  const projectUrl = absoluteUrl(`/proyectos/${slug}`);
  const projectJsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CreativeWork",
        dateModified: project.updatedAt.toISOString(),
        description:
          project.summary ??
          "Proyecto publicado con el nivel de detalle autorizado por el cliente.",
        name: project.title,
        url: projectUrl
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", item: absoluteUrl("/"), name: "Inicio", position: 1 },
          {
            "@type": "ListItem",
            item: absoluteUrl("/proyectos"),
            name: "Proyectos",
            position: 2
          },
          { "@type": "ListItem", item: projectUrl, name: project.title, position: 3 }
        ]
      }
    ]
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(projectJsonLd).replace(/</g, "\\u003c")
        }}
        type="application/ld+json"
      />
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
    </>
  );
}
