import type { Metadata } from "next";

import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Guías, calculadoras y referencias técnicas para comparar equipo, capacidades y especificaciones.",
  path: "/laboratorio",
  title: "Laboratorio y recursos técnicos"
});

export default function LaboratoryPage() {
  return (
    <InformationPage
      closing="¿Necesitas ayuda para comparar opciones?"
      label="JANVIER_LAB / GUÍAS_Y_HERRAMIENTAS"
      lede="Guías, calculadoras y referencias para comparar equipo y entender especificaciones técnicas."
      titleSize="long"
      visualModule={{
        label: "REFERENCIAS / 01–06",
        title: "MEDIR / COMPARAR / DECIDIR",
        stages: ["Capacidad", "Continuidad", "Compatibilidad"],
        signals: [
          { label: "MÉTODO", value: "Práctico" },
          { label: "LECTURA", value: "Operativa" }
        ]
      }}
      sections={[
        {
          title: "Preguntas concretas",
          copy: "Las herramientas responden dudas sobre capacidad, conectividad, energía, almacenamiento y continuidad operativa.",
          items: [
            "Capacidad",
            "Conectividad",
            "Energía",
            "Almacenamiento",
            "Continuidad operativa",
            "Comparación de opciones"
          ]
        },
        {
          title: "Decisiones mejor informadas",
          copy: "Las referencias te ayudan a calcular capacidades y llegar a una cotización con datos más precisos."
        },
        {
          title: "Ayuda cuando la necesitas",
          copy: "Si una herramienta no basta, podemos revisar tu caso y comparar alternativas contigo."
        }
      ]}
      title="Información técnica para comparar mejor."
    />
  );
}
