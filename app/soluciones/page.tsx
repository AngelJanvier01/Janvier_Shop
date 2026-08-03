import { InformationPage } from "@/components/marketing/information-page";

export default function SolutionsPage() {
  return (
    <InformationPage
      closing="Empecemos por entender el problema."
      label="SOLUTIONS / OUTCOMES_OVER_CATEGORIES"
      lede="Las soluciones agrupan capacidades por resultado. No necesitas llegar con la tecnología elegida."
      titleSize="long"
      visualModule={{
        label: "CAPABILITY_MAP / 01–04",
        title: "OPERACIÓN / INFRAESTRUCTURA / CONEXIÓN",
        stages: ["Flujos", "Servicios", "Redes", "Espacios"],
        signals: [
          { label: "CRITERIO", value: "Resultado" },
          { label: "ALCANCE", value: "Integral" }
        ]
      }}
      sections={[
        {
          title: "Operación digital",
          copy: "Software interno, automatización, flujos de aprobación, reportes e integraciones para quitar fricción de tareas repetitivas.",
          items: ["Automatización", "Reportes", "Flujos", "Integraciones"]
        },
        {
          title: "Infraestructura confiable",
          copy: "Servidores, almacenamiento, respaldo, virtualización, energía, monitoreo y documentación para sostener lo que el negocio ya depende de usar.",
          items: ["Servidores", "Respaldo", "Monitoreo", "Energía"]
        },
        {
          title: "Conectividad y seguridad",
          copy: "Redes, Wi-Fi, cableado, acceso remoto, segmentación y criterios de seguridad que consideran la operación completa."
        },
        {
          title: "Espacios tecnológicos",
          copy: "Pantallas, audio, videoconferencia, señalización y salas que se integran para ser usadas, no sólo instaladas."
        }
      ]}
      title="Tecnología organizada alrededor de lo que necesitas lograr."
    />
  );
}
