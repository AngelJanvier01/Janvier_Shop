import type { Metadata } from "next";
import Link from "next/link";

import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "JANVIER organiza solicitudes, diagnósticos, proyectos y propuestas en un espacio privado para clientes y administración.",
  path: "/aplicacion",
  title: "Aplicación"
});

export default function ApplicationPage() {
  return (
    <InformationPage
      closing="Consulta tus proyectos sin perder el historial."
      label="APLICACIÓN / JANVIER"
      lede="Un espacio privado para consultar solicitudes, propuestas, comentarios y decisiones."
      sections={[
        {
          title: "Todo el seguimiento junto",
          copy: "JANVIER reúne solicitudes, diagnósticos, proyectos y propuestas en un espacio privado."
        },
        {
          title: "Propuestas con historial",
          copy: "Puedes revisar cambios, dejar comentarios y registrar decisiones sin buscar entre mensajes y archivos sueltos."
        },
        {
          title: "Avisos de actividad",
          copy: "Si la administración conecta una cuenta de Google, JANVIER sólo la utiliza para enviar avisos de seguridad, solicitudes, comentarios y propuestas."
        },
        {
          title: "La cuenta no se usa para leer correo",
          copy: "JANVIER no accede al contenido del buzón ni utiliza la cuenta para leer, buscar, modificar, eliminar o administrar mensajes."
        },
        {
          title: "Más información",
          copy: (
            <>
              Para conocer cómo se tratan los datos y bajo qué condiciones se usa el
              sitio, consulta <Link href="/privacidad">Privacidad</Link> y{" "}
              <Link href="/terminos">Términos de uso</Link>.
            </>
          )
        }
      ]}
      title="JANVIER"
      titleSize="short"
      visualModule={{
        label: "ESPACIO_PRIVADO / JANVIER",
        signals: [
          { label: "ACCESO", value: "Privado" },
          { label: "AVISOS", value: "Puntuales" }
        ],
        stages: ["Enviar solicitud", "Revisar propuesta", "Dar seguimiento"],
        title: "SOLICITUD / PROPUESTA / DECISIÓN"
      }}
    />
  );
}
