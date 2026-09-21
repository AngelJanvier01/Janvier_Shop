import { ContactForm } from "@/components/marketing/contact-form";
import { InformationPage } from "@/components/marketing/information-page";

export const metadata = {
  description:
    "Cuéntanos qué quieres resolver y prepararemos una primera recomendación técnica.",
  title: "Solicitar diagnóstico"
};

export default function DiagnosticPage() {
  return (
    <InformationPage
      closing="Cuéntanos qué ocurre y revisamos el caso."
      label="DIAGNÓSTICO / PRIMERA_REVISIÓN"
      lede="Describe el problema, cuándo empezó y qué limitaciones tienes. No hace falta que llegues con una solución definida."
      visualModule={{
        label: "SOLICITUD / PRIMERA_REVISIÓN",
        title: "PROBLEMA / DATOS / RECOMENDACIÓN",
        stages: ["Describir", "Revisar", "Responder"],
        signals: [
          { label: "PUNTO DE PARTIDA", value: "Tu caso" },
          { label: "RESPUESTA", value: "Personal" }
        ]
      }}
      sections={[
        {
          title: "Qué conviene compartir",
          copy: "Qué está fallando o qué quieres mejorar, quién lo usa, qué resultado esperas y qué límites de tiempo o presupuesto existen."
        },
        {
          title: "Qué sucede después",
          copy: "Revisamos la solicitud y, si hace falta, te escribimos por WhatsApp o correo. Después te indicamos si conviene un diagnóstico, una cotización o una propuesta."
        }
      ]}
      title="Cuéntanos qué está fallando o qué quieres mejorar."
      titleSize="long"
    >
      <ContactForm />
    </InformationPage>
  );
}
