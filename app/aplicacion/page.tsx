import type { Metadata } from "next";
import Link from "next/link";

import { InformationPage } from "@/components/marketing/information-page";

export const metadata: Metadata = {
  alternates: { canonical: "https://jaanviieer.com/aplicacion" },
  description:
    "JANVIER organiza solicitudes, diagnósticos, proyectos y propuestas en un espacio privado para clientes y administración.",
  title: { absolute: "JANVIER | Aplicación" }
};

export default function ApplicationPage() {
  return (
    <InformationPage
      closing="El contexto también forma parte del trabajo."
      label="APPLICATION / JANVIER"
      lede="Un espacio privado para que clientes y administración puedan seguir el trabajo sin perder lo que ya se decidió."
      sections={[
        {
          title: "El trabajo en un mismo lugar",
          copy: "JANVIER reúne solicitudes, diagnósticos, proyectos y propuestas en un espacio privado para clientes y administración."
        },
        {
          title: "Propuestas que se pueden seguir",
          copy: "Desde ese espacio se puede dar seguimiento a una propuesta, revisar cambios, comentar y registrar decisiones sin depender de cadenas interminables de mensajes."
        },
        {
          title: "Avisos relacionados con el trabajo",
          copy: "Cuando la persona administradora conecta una cuenta de Google, JANVIER la utiliza únicamente para enviar avisos sobre seguridad, solicitudes, comentarios y propuestas."
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
        label: "PRIVATE_WORKSPACE / JANVIER",
        signals: [
          { label: "ACCESO", value: "Privado" },
          { label: "AVISOS", value: "Puntuales" }
        ],
        stages: ["Registrar contexto", "Revisar propuesta", "Dar seguimiento"],
        title: "SOLICITUD / PROPUESTA / DECISIÓN"
      }}
    />
  );
}
