import { InformationPage } from "@/components/marketing/information-page";

export default function ProjectsPage() {
  return (
    <InformationPage
      closing="Tu proyecto puede ser el próximo caso bien contado."
      label="PROJECT_LOG / CONTEXT_REQUIRED"
      lede="Cada caso de JANVIER se publicará con contexto, evidencia y el nivel de confidencialidad que su cliente autorice."
      titleSize="medium"
      sections={[
        {
          title: "No habrá relleno.",
          copy: "El portafolio está preparado para mostrar problema, estrategia, implementación, resultados, tecnologías y métricas. Se publica cuando el trabajo y la autorización existen."
        },
        {
          title: "Privacidad por proyecto",
          copy: "Un caso puede ser anónimo, parcial, autorizado o personalizado. El nombre, logotipo, métricas y enlaces externos nunca se asumen.",
          items: ["ANONIMO", "PARCIAL", "AUTORIZADO", "PERSONALIZADO"]
        },
        {
          title: "Una estructura que explica",
          copy: "La página final de cada proyecto mostrará lo necesario para entender la necesidad, el criterio y el resultado; no sólo una captura bonita."
        }
      ]}
      title="El trabajo merece más que una galería."
    />
  );
}
