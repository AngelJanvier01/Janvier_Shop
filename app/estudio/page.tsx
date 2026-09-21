import type { Metadata } from "next";

import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Desarrollo de software, automatización, consultoría y soporte técnico con atención directa de Angel Janvier.",
  path: "/estudio",
  title: "Desarrollo de software y soporte técnico"
});

export default function StudioPage() {
  return (
    <InformationPage
      closing="¿Qué proceso te gustaría mejorar?"
      label="JANVIER_ESTUDIO / SOFTWARE_E_INGENIERÍA"
      lede="Desarrollamos software a partir de cómo trabaja tu equipo y seguimos involucrados durante la puesta en marcha."
      titleSize="medium"
      visualModule={{
        label: "PROCESO / FORMA_DE_TRABAJO",
        title: "NECESIDAD / DESARROLLO / ENTREGA",
        stages: ["Entender", "Desarrollar", "Implementar"],
        signals: [
          { label: "ENFOQUE", value: "A medida" },
          { label: "ENTREGA", value: "Documentada" }
        ]
      }}
      sections={[
        {
          title: "Desarrollo de software",
          copy: "Desarrollamos plataformas web, sistemas internos, automatizaciones, integraciones, APIs y tableros. Elegimos la tecnología por utilidad, costo y facilidad de adopción.",
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
          copy: "Revisamos arquitectura, proveedores, costos y prioridades para que puedas decidir con información suficiente.",
          items: ["Diagnóstico", "Arquitectura", "Estrategia", "Documentación"]
        },
        {
          title: "Desarrollo web",
          copy: "Creamos sitios y portales con diseño, contenido, accesibilidad, SEO, analítica y las integraciones que necesite tu negocio."
        },
        {
          id: "soporte",
          title: "Soporte y mantenimiento",
          copy: "Damos soporte remoto o en sitio para sistemas, redes y servidores. También documentamos, corregimos y mejoramos lo que ya está en uso."
        }
      ]}
      title="Software que se adapta a tu forma de trabajar."
    />
  );
}
