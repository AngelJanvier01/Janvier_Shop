import type { Metadata } from "next";

import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Consultoría tecnológica, infraestructura, conectividad y espacios equipados para empresas en México.",
  path: "/soluciones",
  title: "Consultoría e infraestructura tecnológica"
});

export default function SolutionsPage() {
  return (
    <InformationPage
      closing="Cuéntanos qué quieres mejorar."
      label="SOLUCIONES / POR_NECESIDAD"
      lede="No necesitas saber qué tecnología comprar. Explícanos el problema y revisamos las opciones contigo."
      titleSize="long"
      visualModule={{
        label: "SERVICIOS / 01–04",
        title: "PROCESOS / INFRAESTRUCTURA / CONECTIVIDAD",
        stages: ["Flujos", "Servicios", "Redes", "Espacios"],
        signals: [
          { label: "PUNTO DE PARTIDA", value: "Tu necesidad" },
          { label: "ALCANCE", value: "A definir" }
        ]
      }}
      sections={[
        {
          title: "Operación digital",
          copy: "Software interno, automatizaciones, aprobaciones, reportes e integraciones para reducir tareas manuales y errores repetitivos.",
          items: ["Automatización", "Reportes", "Flujos", "Integraciones"]
        },
        {
          title: "Infraestructura confiable",
          copy: "Servidores, almacenamiento, respaldos, virtualización, energía y monitoreo para mantener disponibles los sistemas de tu empresa.",
          items: ["Servidores", "Respaldo", "Monitoreo", "Energía"]
        },
        {
          title: "Conectividad y seguridad",
          copy: "Diseñamos e instalamos redes, Wi-Fi, cableado, acceso remoto y segmentación según el uso de cada espacio."
        },
        {
          title: "Espacios tecnológicos",
          copy: "Integramos pantallas, audio, videoconferencia y señalización, y dejamos todo listo para el uso diario."
        }
      ]}
      title="Soluciones para problemas concretos."
    />
  );
}
