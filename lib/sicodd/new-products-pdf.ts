import PDFDocument from "pdfkit";

export type SicoddNewProductReportItem = {
  name: string;
  partNumber: string | null;
  sku: string;
};

type SicoddNewProductReport = {
  finishedAt: Date;
  products: SicoddNewProductReportItem[];
  runSequence: number | null;
};

const palette = {
  border: "#B7B5AE",
  ink: "#171816",
  muted: "#656660",
  paper: "#F2F0EA",
  red: "#D44F39",
  surface: "#FAF8F3"
};
const margin = 36;

function reportDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

function normalized(value: string | null | undefined, fallback = "—") {
  return (value?.trim() || fallback).toLocaleUpperCase("es-MX");
}

export async function createSicoddNewProductsPdf(report: SicoddNewProductReport) {
  const runLabel = report.runSequence
    ? `CORRIDA ${report.runSequence}`
    : "CORRIDA SICODD";
  const document = new PDFDocument({
    bufferPages: true,
    info: {
      Author: "JANVIER",
      Creator: "JANVIER Supply System",
      Keywords: "JANVIER, SICODD, productos nuevos, claves",
      Subject: `Claves de artículos nuevos · ${runLabel}`,
      Title: `Artículos nuevos SICODD · ${runLabel}`
    },
    margin,
    size: "A4"
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });
  const contentWidth = document.page.width - margin * 2;
  const bottom = document.page.height - 66;
  const columns = {
    name: { width: 297, x: margin + 222 },
    partNumber: { width: 102, x: margin + 120 },
    sku: { width: 120, x: margin }
  };

  const paintPage = () => {
    document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
    document.rect(0, 0, document.page.width, 6).fill(palette.red);
  };
  const drawHeader = (continuation = false) => {
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(17)
      .text("JANVIER", margin, 28);
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.4)
      .text(
        continuation
          ? "NUEVOS ARTÍCULOS SICODD / CONTINUACIÓN"
          : "REPORTE DE NUEVOS ARTÍCULOS SICODD",
        275,
        26,
        { align: "right", characterSpacing: 0.3, width: 284 }
      );
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(7.2)
      .text(runLabel, 275, 41, { align: "right", width: 284 });
    document
      .moveTo(margin, 72)
      .lineTo(margin + contentWidth, 72)
      .strokeColor(palette.border)
      .stroke();
  };
  const drawTableHeader = (y: number) => {
    document.rect(margin, y, contentWidth, 22).fill(palette.ink);
    [
      ["CLAVE / SKU", columns.sku],
      ["NÚMERO DE PARTE", columns.partNumber],
      ["ARTÍCULO", columns.name]
    ].forEach(([label, column]) => {
      const item = column as { width: number; x: number };
      document
        .fillColor(palette.paper)
        .font("Courier-Bold")
        .fontSize(6)
        .text(label as string, item.x + 6, y + 8, { width: item.width - 12 });
    });
    return y + 22;
  };
  const startPage = (continuation = false) => {
    if (continuation) document.addPage();
    paintPage();
    drawHeader(continuation);
    if (!continuation) {
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(6.2)
        .text("FECHA DE FINALIZACIÓN", margin, 91, { characterSpacing: 0.25 })
        .fillColor(palette.ink)
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(reportDate(report.finishedAt), margin, 104, { width: 350 })
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(6.2)
        .text("ARTÍCULOS NUEVOS", 420, 91, { align: "right", width: 139 })
        .fillColor(palette.ink)
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(String(report.products.length), 420, 103, { align: "right", width: 139 });
      return drawTableHeader(142);
    }
    return drawTableHeader(88);
  };

  let y = startPage();
  for (const product of report.products) {
    const rowHeight = 32;
    if (y + rowHeight > bottom) y = startPage(true);
    document
      .rect(margin, y, contentWidth, rowHeight)
      .fillAndStroke(palette.surface, palette.border);
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(6.4)
      .text(normalized(product.sku), columns.sku.x + 6, y + 7, {
        ellipsis: true,
        height: 19,
        width: columns.sku.width - 12
      });
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(normalized(product.partNumber), columns.partNumber.x + 6, y + 7, {
        ellipsis: true,
        height: 19,
        width: columns.partNumber.width - 12
      });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(6.8)
      .text(normalized(product.name), columns.name.x + 6, y + 6, {
        ellipsis: true,
        height: 21,
        lineGap: 0.5,
        width: columns.name.width - 12
      });
    y += rowHeight;
  }

  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    const footerY = document.page.height - 46;
    document
      .moveTo(margin, footerY - 8)
      .lineTo(margin + contentWidth, footerY - 8)
      .strokeColor(palette.border)
      .stroke();
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(6.1)
      .text("JANVIER / CONTROL DE CATÁLOGO", margin, footerY, { width: 280 });
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(`${index + 1} / ${pages.count}`, 500, footerY, {
        align: "right",
        width: 59
      });
  }

  document.end();
  return completed;
}
