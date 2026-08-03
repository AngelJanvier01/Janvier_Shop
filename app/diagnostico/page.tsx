import { ContactForm } from "@/components/marketing/contact-form";
import { InformationPage } from "@/components/marketing/information-page";

export const metadata = {
  description:
    "Comparte el contexto de tu operación y JANVIER preparará el siguiente paso técnico.",
  title: "Solicitar diagnóstico"
};

export default function DiagnosticPage() {
  return (
    <InformationPage
      closing="El siguiente paso correcto empieza con una conversación bien preparada."
      label="DIAGNOSTIC / FIRST_RESPONSE"
      lede="No necesitas tener la solución resuelta. Comparte el problema, el momento operativo y las restricciones relevantes; JANVIER ordena el contexto antes de proponer tecnología."
      sections={[
        {
          title: "Qué conviene compartir",
          copy: "El problema actual, quién lo vive, qué resultado esperas y cualquier restricción de tiempo, operación o presupuesto."
        },
        {
          title: "Qué sucede después",
          copy: "La solicitud llega a un tablero privado. Se revisa, se aclara por WhatsApp o correo y sólo entonces se decide si corresponde un diagnóstico, una cotización o una propuesta."
        }
      ]}
      title="Empecemos por el problema correcto."
      titleSize="long"
    >
      <ContactForm />
    </InformationPage>
  );
}
