import type { Metadata } from "next";
import Link from "next/link";

import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";

const contactEmail = "janviersolutionsbusiness@gmail.com";

export const metadata: Metadata = {
  alternates: { canonical: "https://jaanviieer.com/terminos" },
  description:
    "Términos aplicables al uso del sitio, solicitudes, propuestas y espacios privados de JANVIER.",
  title: { absolute: "Términos de uso | JANVIER" }
};

const sections: LegalSection[] = [
  {
    id: "aceptacion",
    title: "Aceptación",
    content: (
      <p>
        Al utilizar este sitio aceptas estos términos en lo aplicable a la navegación, los
        formularios, las propuestas y los espacios privados de JANVIER. Si no estás de
        acuerdo, evita utilizar las funciones que requieran enviar información o acceder a
        un área privada.
      </p>
    )
  },
  {
    id: "servicios",
    title: "Servicios",
    content: (
      <p>
        JANVIER presenta servicios de software, ingeniería, soluciones tecnológicas,
        consultoría, diagnóstico, suministro, propuestas y Project Room. El alcance
        concreto de cada proyecto se define con el contexto y la documentación que
        corresponda.
      </p>
    )
  },
  {
    id: "informacion-del-sitio",
    title: "Información del sitio",
    content: (
      <p>
        El contenido público es informativo y puede cambiar. JANVIER procura que sea útil
        y actual, pero la información publicada no sustituye una revisión específica de
        necesidades, disponibilidad, alcance o condiciones de un proyecto.
      </p>
    )
  },
  {
    id: "solicitudes-y-diagnosticos",
    title: "Solicitudes y diagnósticos",
    content: (
      <p>
        Enviar un formulario o solicitar un diagnóstico no crea automáticamente un
        contrato, relación laboral, garantía de disponibilidad ni obligación de aceptar un
        proyecto. La conversación posterior permite revisar contexto, factibilidad y
        siguientes pasos.
      </p>
    )
  },
  {
    id: "propuestas",
    title: "Propuestas",
    content: (
      <p>
        Las propuestas, alternativas, precios y cronogramas se rigen por el documento
        compartido para cada caso. Una aceptación válida puede generar evidencia y un
        snapshot de la propuesta. Cuando corresponda, las condiciones específicas de ese
        documento prevalecen sobre estos términos generales.
      </p>
    )
  },
  {
    id: "acceso-privado",
    title: "Cuenta administrativa y acceso privado",
    content: (
      <p>
        Algunas áreas requieren autorización. No compartas credenciales, invitaciones ni
        enlaces privados. Están prohibidos los intentos de acceso indebido y JANVIER puede
        revocar accesos por seguridad, integridad operativa o incumplimiento de estas
        reglas.
      </p>
    )
  },
  {
    id: "propiedad-intelectual",
    title: "Propiedad intelectual",
    content: (
      <p>
        La marca, diseño, código, textos, imágenes, documentos y propuestas de JANVIER
        están protegidos conforme a las disposiciones aplicables. Los materiales de
        terceros conservan los derechos de sus titulares y deben utilizarse respetando sus
        condiciones.
      </p>
    )
  },
  {
    id: "uso-permitido",
    title: "Uso permitido",
    content: (
      <ul>
        <li>No interfieras con el servicio ni automatices abuso contra el sitio.</li>
        <li>No intentes vulnerar controles de seguridad ni extraer datos masivamente.</li>
        <li>No suplantes identidades ni uses el sitio para actividades ilícitas.</li>
        <li>
          No uses áreas privadas, invitaciones o contenido compartido fuera de su
          propósito.
        </li>
      </ul>
    )
  },
  {
    id: "servicios-externos",
    title: "Servicios externos",
    content: (
      <p>
        Google, Cloudflare u otros servicios documentados pueden aplicar sus propios
        términos y políticas. Su presencia técnica no implica afiliación, patrocinio ni
        aprobación por parte de esos servicios.
      </p>
    )
  },
  {
    id: "disponibilidad",
    title: "Disponibilidad",
    content: (
      <p>
        JANVIER no garantiza funcionamiento ininterrumpido. Puede haber mantenimiento,
        fallos técnicos, cambios de proveedores, problemas de conectividad o eventos fuera
        de control razonable. Cuando sea posible, se buscará mantener una operación segura
        y recuperar el servicio de forma responsable.
      </p>
    )
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    content: (
      <p>
        En la medida permitida por la legislación aplicable, JANVIER no responde por uso
        indebido del sitio, decisiones tomadas sólo con base en contenido informativo o
        fallos atribuibles a terceros. Esta disposición no excluye responsabilidades que
        legalmente no puedan excluirse.
      </p>
    )
  },
  {
    id: "privacidad",
    title: "Privacidad",
    content: (
      <p>
        El tratamiento de datos personales y el uso de datos de Google se describen en el{" "}
        <Link href="/privacidad">Aviso de privacidad y tratamiento de datos</Link>.
      </p>
    )
  },
  {
    id: "modificaciones",
    title: "Modificaciones",
    content: (
      <p>
        Estos términos pueden actualizarse para reflejar cambios del sitio, sus servicios
        o las disposiciones aplicables. La fecha visible en esta página identifica la
        versión publicada.
      </p>
    )
  },
  {
    id: "legislacion-aplicable",
    title: "Legislación aplicable",
    content: (
      <p>
        Estos términos se interpretarán conforme a la legislación aplicable en México, sin
        perjuicio de las disposiciones imperativas que correspondan.
      </p>
    )
  },
  {
    id: "contacto",
    title: "Contacto",
    content: (
      <p>
        Para dudas sobre estos términos, escribe a{" "}
        <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    )
  }
];

export default function TermsPage() {
  return (
    <LegalDocument
      description="Reglas claras para usar el sitio de JANVIER, enviar solicitudes y participar en propuestas o espacios privados autorizados."
      sections={sections}
      title="Términos de uso"
    />
  );
}
