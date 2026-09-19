import PDFDocument from "pdfkit";

export type CommerceOrderDocument = {
  accountName: string;
  contactName: string;
  customerNotes: string | null;
  items: Array<{
    brand: string | null;
    name: string | null;
    priceWithTax: number | null;
    quantity: number;
    sku: string | null;
  }>;
  reference: string;
  requestedAt: Date;
  status: "REQUESTED" | "REVIEWING" | "CONFIRMED" | "FULFILLED" | "CANCELLED";
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
const statusLabels = {
  CANCELLED: "CANCELADO",
  CONFIRMED: "CONFIRMADO",
  FULFILLED: "ENTREGADO",
  REQUESTED: "RECIBIDO",
  REVIEWING: "EN VALIDACIÓN"
} as const;
const money = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  minimumFractionDigits: 2,
  style: "currency"
});

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function documentDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

export async function createCommerceOrderPdf(
  order: CommerceOrderDocument,
  brandLogo?: Buffer | null
) {
  const document = new PDFDocument({
    bufferPages: true,
    info: {
      Author: "Ángel Janvier",
      Creator: "JANVIER Supply System",
      Keywords: "JANVIER, pedido, suministro tecnológico",
      Subject: `Solicitud de pedido ${order.reference}`,
      Title: `${order.reference} | JANVIER`
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
  const table = {
    description: { width: 243, x: margin },
    price: { width: 78, x: margin + 357 },
    quantity: { width: 52, x: margin + 295 },
    sku: { width: 62, x: margin + 243 },
    total: { width: 84, x: margin + 435 }
  };

  const paintPage = () => {
    document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
    document.rect(0, 0, document.page.width, 6).fill(palette.red);
  };
  const drawHeader = (continuation = false) => {
    if (brandLogo) {
      try {
        document.image(brandLogo, margin, 20, { fit: [92, 42], valign: "center" });
      } catch {
        document
          .fillColor(palette.ink)
          .font("Helvetica-Bold")
          .fontSize(17)
          .text("JANVIER", margin, 30);
      }
    } else {
      document
        .fillColor(palette.ink)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text("JANVIER", margin, 30);
    }
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.5)
      .text(
        continuation ? "SOLICITUD DE PEDIDO / CONTINUACIÓN" : "SOLICITUD DE PEDIDO",
        300,
        27,
        {
          align: "right",
          characterSpacing: 0.35,
          width: contentWidth - 264
        }
      );
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(7.6)
      .text(order.reference, 300, 41, { align: "right", width: contentWidth - 264 });
    document
      .moveTo(margin, 72)
      .lineTo(margin + contentWidth, 72)
      .strokeColor(palette.border)
      .stroke();
  };
  const drawTableHeading = (y: number) => {
    document.rect(margin, y, contentWidth, 22).fill(palette.ink);
    [
      ["PRODUCTO", table.description],
      ["SKU", table.sku],
      ["CANT.", table.quantity],
      ["PRECIO C/IVA", table.price],
      ["TOTAL", table.total]
    ].forEach(([label, column]) => {
      const item = column as { width: number; x: number };
      document
        .fillColor(palette.paper)
        .font("Courier-Bold")
        .fontSize(5.8)
        .text(label as string, item.x + 5, y + 8, {
          characterSpacing: 0.2,
          width: item.width - 10
        });
    });
    return y + 22;
  };

  paintPage();
  drawHeader();
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.4)
    .text("CUENTA COMERCIAL", margin, 91, { characterSpacing: 0.3 });
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(upper(order.accountName), margin, 104, { width: 330 });
  document
    .fillColor(palette.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(upper(order.contactName), margin, 132, { width: 330 });
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.2)
    .text("ESTADO", 385, 91, { width: 160 })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(11)
    .text(statusLabels[order.status], 385, 103, { width: 160 })
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.2)
    .text(documentDate(order.requestedAt), 385, 122, { width: 160 });
  document
    .rect(margin, 156, contentWidth, 44)
    .fillAndStroke(palette.surface, palette.border)
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.2)
    .text("VALIDACIÓN COMERCIAL", margin + 12, 166, { characterSpacing: 0.3, width: 130 })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(
      "NO GENERA COBRO. EXISTENCIA, ENTREGA Y VIGENCIA SE CONFIRMAN ANTES DE PAGAR.",
      margin + 146,
      165,
      {
        width: contentWidth - 158
      }
    );

  let y = drawTableHeading(220);
  const addPage = () => {
    document.addPage();
    paintPage();
    drawHeader(true);
    return drawTableHeading(92);
  };
  let total = 0;
  let hasPendingPrice = false;
  for (const item of order.items) {
    const description = upper(
      [item.brand, item.name].filter(Boolean).join(" / ") || "PRODUCTO"
    );
    const rowHeight = Math.max(
      37,
      document
        .font("Helvetica")
        .fontSize(7.6)
        .heightOfString(description, { width: table.description.width - 10 }) + 16
    );
    if (y + rowHeight > document.page.height - 112) y = addPage();
    document
      .rect(margin, y, contentWidth, rowHeight)
      .strokeColor(palette.border)
      .stroke();
    const itemTotal =
      item.priceWithTax === null ? null : item.priceWithTax * item.quantity;
    if (itemTotal === null) hasPendingPrice = true;
    else total += itemTotal;
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(7.6)
      .text(description, table.description.x + 5, y + 8, {
        width: table.description.width - 10
      });
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(upper(item.sku ?? "—"), table.sku.x + 5, y + 12, {
        width: table.sku.width - 10
      });
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(String(item.quantity), table.quantity.x + 5, y + 11, {
        align: "right",
        width: table.quantity.width - 10
      });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(7.1)
      .text(
        item.priceWithTax === null ? "VALIDAR" : money.format(item.priceWithTax),
        table.price.x + 4,
        y + 12,
        { align: "right", width: table.price.width - 8 }
      );
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(7.1)
      .text(
        itemTotal === null ? "VALIDAR" : money.format(itemTotal),
        table.total.x + 4,
        y + 12,
        { align: "right", width: table.total.width - 8 }
      );
    y += rowHeight;
  }
  if (y + 118 > document.page.height - 66) y = addPage();
  document
    .rect(margin, y + 14, contentWidth, 44)
    .fillAndStroke(palette.surface, palette.border);
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.3)
    .text("TOTAL ESTIMADO C/IVA", margin + 12, y + 28, { characterSpacing: 0.3 });
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text(hasPendingPrice ? "A VALIDAR" : money.format(total), margin + 330, y + 22, {
      align: "right",
      width: contentWidth - 342
    });
  if (order.customerNotes) {
    const noteY = y + 75;
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.2)
      .text("NOTA DEL CLIENTE", margin, noteY, { characterSpacing: 0.25 });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(8)
      .text(order.customerNotes, margin, noteY + 12, {
        width: contentWidth,
        lineGap: 1.4
      });
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
      .text("JANVIER / TECNOLOGÍA, SUMINISTRO E INGENIERÍA", margin, footerY, {
        width: 270
      });
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(`${index + 1} / ${pages.count}`, 500, footerY, { align: "right", width: 59 });
  }

  document.end();
  return completed;
}
