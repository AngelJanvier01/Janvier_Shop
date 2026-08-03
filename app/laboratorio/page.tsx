import { InformationPage } from "@/components/marketing/information-page";

export default function LaboratoryPage() {
  return (
    <InformationPage
      closing="Convirtamos una duda técnica en una decisión clara."
      label="JANVIER_LAB / PRACTICAL_REFERENCE"
      lede="Un espacio para explicar decisiones técnicas con claridad, criterio operativo y recursos que ayuden a comparar opciones."
      titleSize="long"
      visualModule={{
        label: "REFERENCE_FRAME / 01–06",
        title: "MEDIR / COMPARAR / DECIDIR",
        stages: ["Capacidad", "Continuidad", "Compatibilidad"],
        signals: [
          { label: "MÉTODO", value: "Práctico" },
          { label: "LECTURA", value: "Operativa" }
        ]
      }}
      sections={[
        {
          title: "Criterio práctico",
          copy: "El laboratorio parte de preguntas concretas sobre capacidad, conectividad, energía, almacenamiento y continuidad operativa.",
          items: [
            "Capacidad",
            "Conectividad",
            "Energía",
            "Almacenamiento",
            "Continuidad operativa",
            "Criterios de comparación"
          ]
        },
        {
          title: "Decisiones mejor informadas",
          copy: "Las referencias técnicas ayudan a dimensionar necesidades y preparar una conversación útil con datos relevantes."
        },
        {
          title: "Claridad antes de la cotización",
          copy: "Cuando una necesidad requiere validación humana, JANVIER revisa contexto, restricciones y alternativas antes de proponer una solución."
        }
      ]}
      title="Criterio técnico para decidir mejor."
    />
  );
}
