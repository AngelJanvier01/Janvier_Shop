import { InformationPage } from "@/components/marketing/information-page";

export default function StudioPage() {
  return (
    <InformationPage
      closing="Cuéntame qué operación necesitas mejorar."
      label="JANVIER_STUDIO / SOFTWARE_AND_ENGINEERING"
      lede="Diseñamos soluciones alrededor de la operación real: desde la primera conversación hasta que el sistema entra en uso."
      titleSize="medium"
      visualModule={{
        label: "WORKFLOW / DELIVERY_PATH",
        title: "CONTEXTO / SISTEMA / OPERACIÓN",
        stages: ["Escuchar", "Diseñar", "Acompañar"],
        signals: [
          { label: "ENFOQUE", value: "A medida" },
          { label: "ENTREGA", value: "Documentada" }
        ]
      }}
      sections={[
        {
          title: "Desarrollo de software",
          copy: "Plataformas web, sistemas internos, automatización, integraciones, APIs, dashboards y mantenimiento evolutivo. La tecnología se elige por utilidad, costo y capacidad real de adopción.",
          items: [
            "Sistemas internos",
            "Portales",
            "Automatización",
            "Integraciones",
            "Dashboards",
            "APIs"
          ]
        },
        {
          title: "Consultoría tecnológica",
          copy: "Diagnóstico, arquitectura, evaluación de proveedores y planeación para tomar decisiones que sigan funcionando después de la presentación.",
          items: ["Diagnóstico", "Arquitectura", "Estrategia", "Documentación"]
        },
        {
          title: "Desarrollo web",
          copy: "Una página web se trata como producto: arquitectura, diseño, contenido, accesibilidad, SEO, analítica, despliegue y conexión con tus operaciones."
        },
        {
          id: "soporte",
          title: "Soporte y mantenimiento",
          copy: "Acompañamiento remoto o en sitio, mantenimiento preventivo, redes, servidores, documentación y mejoras continuas. Entregar no es desaparecer."
        }
      ]}
      title="Construimos lo que tu operación necesita."
    />
  );
}
