import type { Metadata } from "next";

import founderPortrait from "@/FOTO JANVIER.png";
import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Conoce a Angel Janvier y la forma de trabajo de JANVIER en software, consultoría, infraestructura y suministro tecnológico.",
  path: "/acerca",
  title: "Acerca de Angel Janvier"
});

export default function AboutPage() {
  return (
    <InformationPage
      closing="Hablemos de tu proyecto."
      label="ANGEL JANVIER / INGENIERÍA_Y_CONSULTORÍA"
      lede="JANVIER es el estudio de Angel Janvier, especializado en software, consultoría, infraestructura y suministro tecnológico."
      titleSize="long"
      sections={[
        {
          title: "Qué es JANVIER",
          copy: "Un estudio independiente que desarrolla software, resuelve necesidades de infraestructura y consigue equipo tecnológico para empresas."
        },
        {
          title: "Cómo se trabaja",
          copy: "Primero entendemos la necesidad. Después definimos alcance, costo y tiempos antes de comenzar el trabajo."
        },
        {
          title: "Responsabilidad directa",
          copy: "Angel Janvier participa en las decisiones técnicas y se mantiene involucrado hasta la puesta en marcha."
        }
      ]}
      title="Trato directo de principio a fin."
      visualImage={founderPortrait}
      visualImageAlt="Angel Janvier, fundador de JANVIER"
    />
  );
}
