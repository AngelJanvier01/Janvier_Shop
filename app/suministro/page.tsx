import type { Metadata } from "next";
import Link from "next/link";

import { InformationPage } from "@/components/marketing/information-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata: Metadata = createPageMetadata({
  description:
    "Equipo de cómputo, redes, energía, almacenamiento e infraestructura para empresas, proyectos y compras por volumen.",
  path: "/suministro",
  title: "Suministro tecnológico"
});

export default function SupplyPage() {
  return (
    <InformationPage
      closing="Si no lo ves en el catálogo, pídenoslo."
      label="SUMINISTRO TECNOLÓGICO"
      lede="Conseguimos equipo de cómputo, redes, energía, almacenamiento e infraestructura para compras individuales o por volumen."
      titleSize="medium"
      visualModule={{
        label: "PROCESO_DE_COMPRA / 01–03",
        title: "PRODUCTO / EXISTENCIA / ENTREGA",
        stages: ["Buscar", "Confirmar", "Entregar"],
        signals: [
          { label: "PRECIO", value: "Confirmado" },
          { label: "ATENCIÓN", value: "Directa" }
        ]
      }}
      sections={[
        {
          title: "Busca por producto o necesidad",
          copy: "Puedes buscar un modelo específico o decirnos qué quieres equipar: una oficina, una red, un servidor o una sala de juntas.",
          items: ["Computación", "Redes", "Servidores", "Pantallas", "Audio", "Energía"]
        },
        {
          title: "Precios por cuenta comercial",
          copy: "Las fichas públicas muestran especificaciones. Los precios dependen de la cuenta, la cantidad, la vigencia y la disponibilidad."
        },
        {
          title: "Confirmamos antes de cobrar",
          copy: "Revisamos precio, existencias, envío y condiciones con el proveedor antes de habilitar el pago."
        },
        {
          title: "Catálogo técnico",
          copy: "Cada ficha reúne imágenes, especificaciones, garantía y existencias para que puedas comparar productos."
        }
      ]}
      title="Equipo y tecnología para tu empresa."
    >
      <section className="systemPage">
        <p className="systemPageEyebrow">CATÁLOGO / PRODUCTOS_PUBLICADOS</p>
        <h2>Consulta el catálogo técnico.</h2>
        <p className="systemPageCopy">
          Revisa especificaciones y existencias. Confirmaremos precio y entrega antes de
          la compra.
        </p>
        <div className="systemPageActions">
          <Link href="/suministro/catalogo">Explorar catálogo técnico</Link>
          <Link href="/suministro/registro">Abrir cuenta comercial</Link>
        </div>
      </section>
    </InformationPage>
  );
}
