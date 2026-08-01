import { InformationPage } from "@/components/marketing/information-page";

export default function ContactPage() {
  return (
    <InformationPage
      closing="Cuéntame el problema por WhatsApp."
      label="CONTACT / FIRST_CONVERSATION"
      lede="No necesitas llegar con la solución resuelta. Explica qué está pasando, qué buscas lograr y en qué etapa está tu operación."
      titleSize="medium"
      sections={[
        {
          title: "Proyectos y consultoría",
          copy: "Comparte el contexto, la necesidad, las personas involucradas y cualquier restricción importante. El diagnóstico sirve para encontrar el siguiente paso correcto."
        },
        {
          title: "Suministro",
          copy: "Indica el producto, cantidad, fecha deseada, ubicación y si se trata de una compra individual, empresarial o por volumen."
        },
        {
          title: "Canal de inicio",
          copy: "Mientras se abre el formulario estructurado de V2, WhatsApp es el canal directo para iniciar una conversación con JANVIER."
        }
      ]}
      title="Empieza por contar el problema."
    />
  );
}
