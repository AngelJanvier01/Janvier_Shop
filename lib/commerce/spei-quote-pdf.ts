import PDFDocument from "pdfkit";

export type SpeiQuoteDocument = {
  bankAccount: {
    accountNumber: string | null;
    accountType: string;
    alias: string;
    bankName: string;
    beneficiary: string;
    clabe: string | null;
    currency: string;
  };
  customerCompanyName: string;
  customerContactName: string;
  customerEmail: string;
  discountAmount: number;
  discountPercentage: number;
  expiresAt: Date;
  issuedAt: Date;
  items: Array<{
    brand: string | null;
    lineTotal: number;
    name: string | null;
    quantity: number;
    sku: string | null;
    unitPrice: number;
  }>;
  reference: string;
  sellerContact: string | null;
  sellerName: string;
  sellerTerms: string | null;
  subtotal: number;
  total: number;
  totalBeforeDiscount: number;
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
const money = new Intl.NumberFormat("es-MX", {
  currency: "MXN",
  minimumFractionDigits: 2,
  style: "currency"
});

function date(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

export async function createSpeiQuotePdf(
  quote: SpeiQuoteDocument,
  brandLogo?: Buffer | null
) {
  const document = new PDFDocument({
    bufferPages: true,
    info: {
      Author: "JANVIER",
      Creator: "JANVIER Supply System",
      Keywords: "JANVIER, cotización, SPEI, suministro tecnológico",
      Subject: `Cotización SPEI ${quote.reference}`,
      Title: `${quote.reference} | JANVIER`
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
  const width = document.page.width - margin * 2;
  const drawPage = () => {
    document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
    document.rect(0, 0, document.page.width, 6).fill(palette.red);
  };
  const drawHeader = (continued = false) => {
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
      .text(continued ? "COTIZACIÓN SPEI / CONTINUACIÓN" : "COTIZACIÓN SPEI", 300, 27, {
        align: "right",
        characterSpacing: 0.35,
        width: width - 264
      })
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(7.6)
      .text(quote.reference, 300, 41, { align: "right", width: width - 264 })
      .moveTo(margin, 72)
      .lineTo(margin + width, 72)
      .strokeColor(palette.border)
      .stroke();
  };
  const drawTableHead = (y: number) => {
    document.rect(margin, y, width, 21).fill(palette.ink);
    const cells = [
      ["PRODUCTO", margin + 7, 235],
      ["SKU", margin + 242, 68],
      ["CANT.", margin + 310, 43],
      ["PRECIO", margin + 353, 76],
      ["TOTAL", margin + 429, 94]
    ] as const;
    for (const [label, x, cellWidth] of cells) {
      document
        .fillColor(palette.paper)
        .font("Courier-Bold")
        .fontSize(5.8)
        .text(label, x, y + 8, {
          width: cellWidth - 8,
          ...(label === "PRECIO" || label === "TOTAL" ? { align: "right" } : {})
        });
    }
    return y + 21;
  };

  drawPage();
  drawHeader();
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.1)
    .text("CLIENTE", margin, 89, { characterSpacing: 0.25 })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(upper(quote.customerCompanyName), margin, 100, { width: 300 })
    .fillColor(palette.muted)
    .font("Helvetica")
    .fontSize(7.3)
    .text(`${upper(quote.customerContactName)} · ${quote.customerEmail}`, margin, 121, {
      width: 315
    })
    .font("Courier")
    .fontSize(6.1)
    .text("EMISIÓN", 385, 89, { width: 160 })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(date(quote.issuedAt), 385, 100, { width: 160 })
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.1)
    .text("VIGENTE HASTA", 385, 121, { width: 160 })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text(date(quote.expiresAt), 385, 132, { width: 160 });

  document.rect(margin, 153, width, 46).fillAndStroke(palette.surface, palette.border);
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.2)
    .text("PAGO DIRECTO / TRANSFERENCIA SPEI", margin + 12, 164, {
      characterSpacing: 0.3
    })
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(
      "DOCUMENTO COMERCIAL FIJO. TRANSFIERE EL IMPORTE EXACTO Y USA LA REFERENCIA INDICADA.",
      margin + 12,
      177,
      { width: width - 24 }
    );

  let y = drawTableHead(221);
  const addPage = () => {
    document.addPage();
    drawPage();
    drawHeader(true);
    return drawTableHead(92);
  };
  for (const item of quote.items) {
    const description = upper(
      [item.brand, item.name].filter(Boolean).join(" / ") || "PRODUCTO"
    );
    const rowHeight = Math.max(
      36,
      document
        .font("Helvetica")
        .fontSize(7.5)
        .heightOfString(description, { width: 225 }) + 15
    );
    if (y + rowHeight > document.page.height - 235) y = addPage();
    document.rect(margin, y, width, rowHeight).strokeColor(palette.border).stroke();
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(7.5)
      .text(description, margin + 7, y + 8, { width: 225 })
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6)
      .text(upper(item.sku ?? "—"), margin + 242, y + 11, { width: 62 })
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(7.6)
      .text(String(item.quantity), margin + 310, y + 11, { align: "right", width: 36 })
      .font("Helvetica")
      .text(money.format(item.unitPrice), margin + 353, y + 11, {
        align: "right",
        width: 69
      })
      .font("Helvetica-Bold")
      .text(money.format(item.lineTotal), margin + 429, y + 11, {
        align: "right",
        width: 87
      });
    y += rowHeight;
  }
  if (y + 195 > document.page.height - 48) y = addPage();
  document.rect(margin, y + 13, width, 74).fillAndStroke(palette.surface, palette.border);
  const totals = [
    ["SUBTOTAL C/IVA", money.format(quote.subtotal)],
    [
      `DESCUENTO SPEI (${quote.discountPercentage.toFixed(2)}%)`,
      `−${money.format(quote.discountAmount)}`
    ],
    ["TOTAL ANTES DE DESCUENTO", money.format(quote.totalBeforeDiscount)]
  ];
  totals.forEach(([label, value], index) => {
    const rowY = y + 23 + index * 15;
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(label, margin + 12, rowY, { width: 230 });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(8)
      .text(value, margin + 300, rowY - 1, { align: "right", width: width - 312 });
  });
  const finalY = y + 101;
  document.rect(margin, finalY, width, 69).fill(palette.ink);
  document
    .fillColor(palette.paper)
    .font("Courier")
    .fontSize(6.5)
    .text("TOTAL A TRANSFERIR / MXN", margin + 13, finalY + 14, {
      characterSpacing: 0.35
    })
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(money.format(quote.total), margin + 13, finalY + 28, { width: 250 })
    .fillColor("#FF826C")
    .font("Courier-Bold")
    .fontSize(8.3)
    .text("REFERENCIA", margin + 316, finalY + 17, { width: 180 })
    .fillColor(palette.paper)
    .font("Courier-Bold")
    .fontSize(12)
    .text(quote.reference, margin + 316, finalY + 33, { width: 180 });

  const bankY = finalY + 92;
  document.rect(margin, bankY, width, 115).fillAndStroke(palette.surface, palette.border);
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.2)
    .text("DATOS PARA TRANSFERENCIA", margin + 12, bankY + 13, { characterSpacing: 0.3 });
  const bankRows = [
    ["BANCO", quote.bankAccount.bankName],
    ["BENEFICIARIO", quote.bankAccount.beneficiary],
    ["CLABE", quote.bankAccount.clabe ?? "—"],
    ["CUENTA", quote.bankAccount.accountNumber ?? "—"],
    ["CONCEPTO", quote.reference]
  ];
  bankRows.forEach(([label, value], index) => {
    const rowY = bankY + 29 + index * 15;
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6)
      .text(label, margin + 12, rowY, { width: 100 });
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(7.8)
      .text(value, margin + 122, rowY - 1, { width: width - 134 });
  });
  const termsY = bankY + 132;
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.1)
    .text("CONDICIONES", margin, termsY, { characterSpacing: 0.25 })
    .fillColor(palette.ink)
    .font("Helvetica")
    .fontSize(7.4)
    .text(
      quote.sellerTerms ??
        "Esta cotización se mantiene vigente hasta la fecha indicada. Reportar una transferencia no confirma el pago; JANVIER la verificará antes de preparar el pedido.",
      margin,
      termsY + 12,
      { lineGap: 1.4, width }
    );
  if (quote.sellerContact) {
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(
        `CONTACTO / ${quote.sellerName}: ${quote.sellerContact}`,
        margin,
        termsY + 58,
        { width }
      );
  }
  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    const footerY = document.page.height - 38;
    document
      .moveTo(margin, footerY - 8)
      .lineTo(margin + width, footerY - 8)
      .strokeColor(palette.border)
      .stroke()
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(6.1)
      .text("JANVIER / TECNOLOGÍA, SUMINISTRO E INGENIERÍA", margin, footerY, {
        width: 280
      })
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(`${index + 1} / ${pages.count}`, 500, footerY, { align: "right", width: 59 });
  }
  document.end();
  return completed;
}
