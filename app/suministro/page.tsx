import { InformationPage } from "@/components/marketing/information-page";

export default function SupplyPage() {
  return (
    <InformationPage
      closing="Si no aparece, también puedes solicitarlo."
      label="SPECIALIZED_SUPPLY / VALIDATED_BEFORE_PAYMENT"
      lede="Desde equipo cotidiano hasta infraestructura crítica. Compras individuales, mayoreo, proyectos y solicitudes especiales."
      titleSize="medium"
      sections={[
        {
          title: "Descubrimiento por intención",
          copy: "Puedes buscar un producto específico o partir de la necesidad: equipar una oficina, renovar computadoras, montar una red o preparar una sala.",
          items: ["Computación", "Redes", "Servidores", "Pantallas", "Audio", "Energía"]
        },
        {
          title: "Precio según relación comercial",
          copy: "La ficha pública muestra especificaciones para decidir. Los precios dependen del perfil comercial aprobado, condiciones, vigencia y disponibilidad."
        },
        {
          title: "Validar antes de cobrar",
          copy: "Una solicitud se revisa con proveedor, costo, existencia, envío y condiciones. Se confirma o ajusta antes de que el cliente pague."
        },
        {
          title: "Catálogo en construcción",
          copy: "La V2 está preparando el catálogo de lectura y el flujo de solicitud. No publicaremos productos pobres ni precios desactualizados por llenar espacio."
        }
      ]}
      title="Suministro especializado con criterio técnico."
    />
  );
}
