import { InformationPage } from "@/components/marketing/information-page";

export default function LaboratoryPage() {
  return (
    <InformationPage
      closing="Las primeras herramientas están entrando al laboratorio."
      label="JANVIER_LAB / USEFUL_BY_DEFAULT"
      lede="Recursos técnicos para atraer tráfico útil, demostrar criterio y resolver algo antes de pedir información."
      titleSize="long"
      sections={[
        {
          title: "Herramientas previstas",
          copy: "El laboratorio abrirá con utilidades que funcionen sin registro, expliquen resultados y permitan copiar o descargar lo necesario.",
          items: [
            "Generador QR",
            "Almacenamiento",
            "Ancho de banda",
            "UPS",
            "Firma de correo",
            "Servidor orientativo"
          ]
        },
        {
          title: "Una regla simple",
          copy: "Una herramienta debe dar valor antes de convertir. Si ayuda a dimensionar, calcular o decidir, el siguiente paso puede ser una conversación más informada."
        },
        {
          title: "Sin formularios antes de la respuesta",
          copy: "No se bloqueará una suma sencilla detrás de un correo. La conversión llegará después de que la herramienta haya sido realmente útil."
        }
      ]}
      title="Herramientas que hacen el trabajo antes de pedirte algo."
    />
  );
}
