import { ContactForm } from "@/components/marketing/contact-form";
import { InformationPage } from "@/components/marketing/information-page";

export default function ContactPage() {
  return (
    <InformationPage
      closing="Empecemos por el contexto correcto."
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
          title: "Primera conversación",
          copy: "El formulario prepara un mensaje claro para WhatsApp con el contexto que compartas. Es un canal directo: no almacenamos la solicitud en esta web."
        }
      ]}
      title="Empieza por contar el problema."
    >
      <ContactForm />
    </InformationPage>
  );
}
