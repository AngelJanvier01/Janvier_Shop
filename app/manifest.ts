import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#ebe9e2",
    description:
      "Software, consultoría, infraestructura y suministro tecnológico de JANVIER.",
    display: "standalone",
    icons: [
      {
        sizes: "1600x1600",
        src: "/brand/angel_janvier_monogram_black_1600.png",
        type: "image/png"
      }
    ],
    lang: "es-MX",
    name: "JANVIER",
    short_name: "JANVIER",
    start_url: "/",
    theme_color: "#171714"
  };
}
