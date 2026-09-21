import { ImageResponse } from "next/og";

export const alt = "JANVIER — software, consultoría y suministro tecnológico";
export const contentType = "image/png";
export const size = { height: 630, width: 1200 };

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background: "#ebe9e2",
        color: "#171714",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "64px 72px",
        width: "100%"
      }}
    >
      <div style={{ display: "flex", fontFamily: "monospace", fontSize: 22 }}>
        JANVIER_01 / ZACATECAS_MX
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "sans-serif",
            fontSize: 112,
            fontWeight: 600,
            letterSpacing: "-5px",
            lineHeight: 0.9
          }}
        >
          JANVIER
        </div>
        <div style={{ display: "flex", fontFamily: "sans-serif", fontSize: 35 }}>
          Software, consultoría y suministro tecnológico.
        </div>
      </div>
      <div
        style={{
          borderTop: "2px solid #171714",
          display: "flex",
          fontFamily: "monospace",
          fontSize: 20,
          justifyContent: "space-between",
          paddingTop: 22
        }}
      >
        <span>DESARROLLO / INFRAESTRUCTURA / EQUIPO</span>
        <span>JAANVIIEER.COM</span>
      </div>
    </div>,
    size
  );
}
