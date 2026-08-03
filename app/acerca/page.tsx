import founderPortrait from "@/FOTO JANVIER.png";
import { InformationPage } from "@/components/marketing/information-page";

export default function AboutPage() {
  return (
    <InformationPage
      closing="Trabajemos desde el diagnóstico hasta la puesta en marcha."
      label="FOUNDER / ENGINEER / CONSULTANT"
      lede="JANVIER tiene una persona real detrás. Angel Janvier combina ingeniería de software, consultoría, infraestructura y experiencia operativa."
      titleSize="long"
      sections={[
        {
          title: "Qué es JANVIER",
          copy: "Una firma independiente de software, ingeniería y suministro tecnológico que puede acompañar desde la primera conversación hasta que la solución entra en operación."
        },
        {
          title: "Cómo se trabaja",
          copy: "La conversación comienza por el problema. Después se diagnostica, se define alcance, se propone, se implementa y se acompaña."
        },
        {
          title: "Responsabilidad directa",
          copy: "Angel Janvier acompaña personalmente cada proyecto estratégico, desde la decisión técnica hasta la puesta en marcha."
        }
      ]}
      title="Tecnología con una persona responsable detrás."
      visualImage={founderPortrait}
      visualImageAlt="Angel Janvier, fundador de JANVIER"
    />
  );
}
