import type { Metadata } from "next";

import { LegalDocument, type LegalSection } from "@/components/marketing/legal-document";

const contactEmail = "janviersolutionsbusiness@gmail.com";

export const metadata: Metadata = {
  alternates: { canonical: "https://jaanviieer.com/privacidad" },
  description:
    "Cómo JANVIER trata los datos personales y los datos de Google usados para correo transaccional.",
  title: { absolute: "Privacidad | JANVIER" }
};

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable",
    content: (
      <p>
        JANVIER es responsable del tratamiento descrito en este aviso. El sitio presenta
        el trabajo de Angel Janvier y permite iniciar conversaciones, diagnósticos,
        propuestas y espacios privados de proyecto. Para preguntas sobre privacidad,
        escribe a <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
      </p>
    )
  },
  {
    id: "datos-proporcionados",
    title: "Datos que proporcionas",
    content: (
      <>
        <p>
          Cuando utilizas los formularios y espacios privados de JANVIER, puedes
          proporcionar datos de contacto y contexto necesarios para atender la solicitud o
          el proyecto.
        </p>
        <ul>
          <li>
            Nombre, correo electrónico y, si lo proporcionas, teléfono y organización.
          </li>
          <li>
            Área de interés, horizonte, rango de inversión estimada y otros datos del
            diagnóstico o de la solicitud.
          </li>
          <li>
            Detalles de proyecto, mensajes y el contexto que compartes voluntariamente.
          </li>
          <li>
            Comentarios, decisiones o confirmaciones registrados por personas autorizadas
            en propuestas y Project Room.
          </li>
        </ul>
      </>
    )
  },
  {
    id: "datos-tecnicos",
    title: "Datos técnicos y seguridad",
    content: (
      <>
        <p>
          Para operar y proteger el sitio se pueden tratar fecha y hora de acceso,
          información general de navegador o dispositivo, eventos de seguridad y registros
          técnicos saneados. La dirección IP puede tratarse de forma limitada y temporal
          para prevenir abuso y generar controles de seguridad.
        </p>
        <p>
          JANVIER utiliza cookies esenciales de sesión cuando una zona privada requiere
          autenticación. Este aviso no declara cookies publicitarias ni perfiles de
          publicidad.
        </p>
      </>
    )
  },
  {
    featured: true,
    id: "uso-de-datos-de-google",
    title: "Uso de datos de Google",
    content: (
      <>
        <p>
          El panel administrativo privado de JANVIER puede conectar una cuenta Google para
          enviar notificaciones transaccionales mediante Gmail API. Esa conexión es una
          función administrativa visible y no forma parte de la navegación pública.
        </p>
        <p>Los únicos scopes solicitados son:</p>
        <ul>
          <li>
            <code>openid</code>
          </li>
          <li>
            <code>email</code>
          </li>
          <li>
            <code>profile</code>
          </li>
          <li>
            <code>https://www.googleapis.com/auth/gmail.send</code>
          </li>
        </ul>
        <p>
          Cuando existe una conexión autorizada, JANVIER procesa la dirección de la
          cuenta, nombre o perfil básico autorizado, scopes concedidos, estado de
          conexión, refresh token cifrado e identificadores técnicos de envío cuando son
          necesarios. La única acción permitida es enviar notificaciones transaccionales
          por Gmail API.
        </p>
        <p>
          JANVIER no lee ni busca mensajes de Gmail, no accede al contenido de correos, no
          los modifica ni elimina, y no accede a contactos, Drive, Calendar ni aliases.
          Tampoco vende datos ni utiliza datos de Google para publicidad.
        </p>
        <p>
          El refresh token se cifra con AES-256-GCM y la llave maestra se conserva fuera
          de PostgreSQL. Los access tokens se usan temporalmente en memoria. Al
          desconectar Google se elimina el secreto local; también puedes revocar el acceso
          desde tu cuenta Google. Mientras el proveedor está desconectado, la cola queda
          conservada sin enviar.
        </p>
        <p>
          El uso y la transferencia de información recibida desde las APIs de Google se
          ajustan a la{" "}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            rel="noreferrer"
            target="_blank"
          >
            Política de Datos de Usuario de los Servicios API de Google
          </a>
          , incluidos sus requisitos de Uso Limitado.
        </p>
      </>
    )
  },
  {
    id: "finalidades",
    title: "Finalidades",
    content: (
      <ul>
        <li>Responder solicitudes y realizar diagnósticos.</li>
        <li>Administrar propuestas, Project Room y actualizaciones relacionadas.</li>
        <li>Enviar alertas de seguridad y notificaciones transaccionales autorizadas.</li>
        <li>Generar reportes administrativos y mantener trazabilidad operativa.</li>
        <li>Mantener la seguridad del sitio y cumplir obligaciones aplicables.</li>
      </ul>
    )
  },
  {
    id: "comparticion",
    title: "Compartición",
    content: (
      <>
        <p>
          JANVIER no vende datos personales ni comparte datos de Google con anunciantes.
          Google procesa las solicitudes necesarias para Gmail API cuando una conexión
          administrativa está activa. Los proveedores técnicos pueden procesar datos
          exclusivamente para operar la infraestructura cuando aplique.
        </p>
        <p>
          La información también puede revelarse si una obligación legal aplicable lo
          requiere.
        </p>
      </>
    )
  },
  {
    id: "conservacion",
    title: "Conservación",
    content: (
      <p>
        Los datos se conservan durante el tiempo necesario para prestar el servicio,
        mantener la seguridad, atender necesidades operativas y cumplir obligaciones
        aplicables. Los refresh tokens se mantienen sólo mientras la conexión está activa
        y se eliminan localmente al desconectarla. Los respaldos protegidos siguen sus
        ciclos de rotación.
      </p>
    )
  },
  {
    id: "seguridad",
    title: "Seguridad",
    content: (
      <p>
        JANVIER aplica cifrado de secretos, controles de acceso, autenticación
        administrativa, minimización de datos, registros saneados, respaldos protegidos y
        separación entre datos públicos e internos. Ninguna medida elimina por completo
        todos los riesgos, por lo que los controles se revisan y actualizan según sea
        necesario.
      </p>
    )
  },
  {
    id: "derechos-y-contacto",
    title: "Derechos y contacto",
    content: (
      <p>
        Puedes solicitar acceso, rectificación, actualización, eliminación o cancelación
        cuando proceda, oposición e información sobre el tratamiento de tus datos. Escribe
        a <a href={`mailto:${contactEmail}`}>{contactEmail}</a> para iniciar la solicitud.
      </p>
    )
  },
  {
    id: "cambios",
    title: "Cambios a este aviso",
    content: (
      <p>
        Este aviso puede actualizarse cuando cambie el sitio, sus funciones o las
        obligaciones aplicables. La fecha de última actualización mostrada en esta página
        identifica la versión vigente.
      </p>
    )
  }
];

export default function PrivacyPage() {
  return (
    <LegalDocument
      description="Información clara sobre los datos que JANVIER trata para operar el sitio, atender solicitudes y enviar notificaciones transaccionales autorizadas."
      sections={sections}
      title="Aviso de privacidad y tratamiento de datos"
    />
  );
}
