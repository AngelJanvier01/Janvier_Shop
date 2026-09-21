import type { Metadata } from "next";

import { ContactForm } from "@/components/marketing/contact-form";
import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Cuéntanos qué necesitas desarrollar, resolver o equipar. JANVIER revisará el caso y te responderá directamente.",
  path: "/contacto",
  title: "Contacto"
});

export default function ContactPage() {
  return (
    <InformationPage
      closing="Cuéntanos qué necesitas y te respondemos."
      label="CONTACTO / PRIMERA_CONVERSACIÓN"
      lede="Dinos qué está pasando, qué quieres lograr y si tienes alguna fecha o presupuesto en mente."
      titleSize="medium"
      visualModule={{
        label: "CONTACTO / 01–03",
        title: "DATOS / REVISIÓN / RESPUESTA",
        stages: ["Compartir", "Revisar", "Conversar"],
        signals: [
          { label: "CANAL", value: "Directo" },
          { label: "DATOS", value: "Privados" }
        ]
      }}
      sections={[
        {
          title: "Proyectos y consultoría",
          copy: "Cuéntanos qué necesitas, quién usará la solución y qué restricciones debemos considerar. Con eso podemos preparar una primera recomendación."
        },
        {
          title: "Suministro",
          copy: "Indica el producto, cantidad, fecha deseada, ubicación y si se trata de una compra individual, empresarial o por volumen."
        },
        {
          title: "Primera conversación",
          copy: "Tu solicitud se guarda de forma privada. Después de enviarla, puedes seguir la conversación por WhatsApp sin volver a explicar todo."
        }
      ]}
      title="Cuéntanos qué necesitas."
    >
      <ContactForm />
    </InformationPage>
  );
}
