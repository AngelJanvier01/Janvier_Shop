import Link from "next/link";

import { InformationPage } from "@/components/marketing/information-page";

export default function SupplyPage() {
  return (
    <InformationPage
      closing="Si no aparece, tambien puedes solicitarlo."
      label="SPECIALIZED_SUPPLY / VALIDATED_BEFORE_PAYMENT"
      lede="Desde equipo cotidiano hasta infraestructura critica. Compras individuales, mayoreo, proyectos y solicitudes especiales."
      titleSize="medium"
      sections={[
        {
          title: "Descubrimiento por intencion",
          copy: "Puedes buscar un producto especifico o partir de la necesidad: equipar una oficina, renovar computadoras, montar una red o preparar una sala.",
          items: ["Computacion", "Redes", "Servidores", "Pantallas", "Audio", "Energia"]
        },
        {
          title: "Precio segun relacion comercial",
          copy: "La ficha publica muestra especificaciones para decidir. Los precios dependen del perfil comercial aprobado, condiciones, vigencia y disponibilidad."
        },
        {
          title: "Validar antes de cobrar",
          copy: "Una solicitud se revisa con proveedor, costo, existencia, envio y condiciones. Se confirma o ajusta antes de que el cliente pague."
        },
        {
          title: "Catalogo de lectura",
          copy: "El catalogo tecnico ya esta preparado para consultar fichas reales sin publicar precios que puedan desactualizarse."
        }
      ]}
      title="Suministro especializado con criterio tecnico."
    >
      <section className="systemPage">
        <p className="systemPageEyebrow">CATALOG / READY_FOR_VALIDATION</p>
        <h1>Explora las fichas tecnicas publicadas.</h1>
        <p className="systemPageCopy">
          Consulta el equipo disponible y solicita una validacion humana antes de comprar.
        </p>
        <Link href="/suministro/catalogo">Explorar catalogo tecnico</Link>
      </section>
    </InformationPage>
  );
}
