export type NavigationItem = {
  href: string;
  label: string;
};

export const primaryNavigation: NavigationItem[] = [
  { href: "/estudio", label: "Estudio" },
  { href: "/soluciones", label: "Soluciones" },
  { href: "/proyectos", label: "Proyectos" },
  { href: "/suministro", label: "Suministro" },
  { href: "/laboratorio", label: "Laboratorio" },
  { href: "/acerca", label: "Acerca" }
];

export const whatsappNumber = "5214923940983";

export function createWhatsAppUrl(message?: string) {
  const text = message?.trim();
  return text
    ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${whatsappNumber}`;
}

export const whatsappUrl = createWhatsAppUrl(
  "Hola, miré su página web y estoy interesado. Quisiera más información, por favor."
);
