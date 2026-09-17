import PDFDocument from "pdfkit";

export type ProductInformationDocument = {
  brand: string | null;
  category: string;
  description: string;
  image?: Buffer | null;
  name: string;
  partNumber: string | null;
  sku: string;
  specialOrder: boolean;
  specifications: Array<{ label: string; value: string }>;
  stockTotal: number | null;
  upc: string | null;
  warrantyYears: number | null;
};

const palette = {
  border: "#B7B5AE",
  ink: "#171816",
  muted: "#656660",
  paper: "#F2F0EA",
  red: "#D44F39",
  surface: "#FAF8F3",
  white: "#FFFFFF",
  green: "#39755C"
};

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function availabilityLabel(product: ProductInformationDocument) {
  if (product.stockTotal !== null) {
    return `${product.stockTotal} ${product.stockTotal === 1 ? "UNIDAD DISPONIBLE" : "UNIDADES DISPONIBLES"}`;
  }
  return product.specialOrder ? "DISPONIBLE BAJO PEDIDO" : "DISPONIBILIDAD A CONFIRMAR";
}

export async function createProductInformationPdf(product: ProductInformationDocument) {
  const document = new PDFDocument({
    bufferPages: true,
    info: {
      Author: "JANVIER",
      Creator: "JANVIER Supply System",
      Subject: `Ficha técnica ${product.sku}`,
      Title: product.name
    },
    margin: 42,
    size: "A4"
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const contentWidth = document.page.width - 84;
  const rightColumnX = 320;
  const rightColumnWidth = document.page.width - rightColumnX - 42;

  document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
  document.rect(0, 0, document.page.width, 8).fill(palette.red);
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(18)
    .text("JANVIER", 42, 34);
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(7.5)
    .text("SUPPLY_SYSTEM / PRODUCT_INFORMATION", 42, 59, { characterSpacing: 0.55 });
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(7.5)
    .text(`SKU ${upper(product.sku)}`, rightColumnX, 40, {
      align: "right",
      characterSpacing: 0.4,
      width: rightColumnWidth
    });

  const heroY = 94;
  document.rect(42, heroY, 246, 246).fillAndStroke(palette.white, palette.border);
  if (product.image) {
    try {
      document.image(product.image, 57, heroY + 15, {
        align: "center",
        fit: [216, 216],
        valign: "center"
      });
    } catch {
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(8)
        .text("IMAGEN NO DISPONIBLE", 57, heroY + 116, {
          align: "center",
          width: 216
        });
    }
  } else {
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(8)
      .text("IMAGEN EN VALIDACIÓN", 57, heroY + 116, {
        align: "center",
        width: 216
      });
  }

  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(7.2)
    .text(
      `${upper(product.category)} / ${upper(product.brand ?? "MARCA A CONFIRMAR")}`,
      rightColumnX,
      heroY,
      {
        characterSpacing: 0.35,
        width: rightColumnWidth
      }
    );
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(22)
    .text(upper(product.name), rightColumnX, heroY + 22, {
      lineGap: -1,
      width: rightColumnWidth
    });
  const titleBottom = document.y + 18;
  document.rect(rightColumnX, titleBottom, rightColumnWidth, 54).fill(palette.green);
  document
    .fillColor(palette.white)
    .font("Courier-Bold")
    .fontSize(11)
    .text(availabilityLabel(product), rightColumnX + 14, titleBottom + 20, {
      characterSpacing: 0.35,
      width: rightColumnWidth - 28
    });

  const identityY = Math.max(titleBottom + 74, heroY + 260);
  const identities = [
    ["MARCA", product.brand ?? "A CONFIRMAR"],
    ["NÚMERO DE PARTE", product.partNumber ?? "A CONFIRMAR"],
    ["UPC / SKU", product.upc ?? product.sku],
    [
      "GARANTÍA",
      product.warrantyYears
        ? `${product.warrantyYears} ${product.warrantyYears === 1 ? "AÑO" : "AÑOS"}`
        : "A CONFIRMAR"
    ]
  ];
  identities.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = 42 + column * (contentWidth / 2);
    const y = identityY + row * 38;
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(7)
      .text(label, x, y, { characterSpacing: 0.35, width: contentWidth / 2 - 16 });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(9)
      .text(upper(value), x, y + 13, { width: contentWidth / 2 - 16 });
  });

  let y = identityY + 88;
  document
    .moveTo(42, y)
    .lineTo(42 + contentWidth, y)
    .strokeColor(palette.border)
    .stroke();
  y += 24;
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("ESPECIFICACIONES", 42, y);
  y += 29;

  const specs = product.specifications.length
    ? product.specifications
    : [{ label: "Estado", value: "Ficha en validación técnica" }];

  const addPage = () => {
    document.addPage();
    document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
    document.rect(0, 0, document.page.width, 8).fill(palette.red);
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("JANVIER", 42, 30);
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(7)
      .text(`FICHA TÉCNICA / SKU ${upper(product.sku)}`, 42, 51);
    return 82;
  };

  for (const specification of specs) {
    const label = upper(specification.label);
    const value = upper(specification.value);
    const rowHeight = Math.max(
      29,
      document
        .font("Helvetica")
        .fontSize(8.5)
        .heightOfString(value, {
          width: contentWidth * 0.6 - 14
        }) + 14
    );
    if (y + rowHeight > document.page.height - 86) y = addPage();
    document
      .moveTo(42, y)
      .lineTo(42 + contentWidth, y)
      .strokeColor(palette.border)
      .stroke();
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(7)
      .text(label, 42, y + 9, {
        characterSpacing: 0.25,
        width: contentWidth * 0.4 - 14
      });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(8.5)
      .text(value, 42 + contentWidth * 0.4, y + 8, {
        width: contentWidth * 0.6
      });
    y += rowHeight;
  }
  document
    .moveTo(42, y)
    .lineTo(42 + contentWidth, y)
    .strokeColor(palette.border)
    .stroke();

  const descriptionHeight = document
    .font("Helvetica")
    .fontSize(9.5)
    .heightOfString(product.description, { lineGap: 3, width: contentWidth });
  if (y + descriptionHeight + 90 > document.page.height - 70) y = addPage();
  y += 26;
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("DESCRIPCIÓN", 42, y);
  y += 27;
  document
    .fillColor(palette.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text(product.description, 42, y, {
      lineGap: 3,
      width: contentWidth
    });

  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    const footerY = document.page.height - 60;
    document
      .moveTo(42, footerY - 10)
      .lineTo(42 + contentWidth, footerY - 10)
      .strokeColor(palette.border)
      .stroke();
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.8)
      .text(
        "INFORMACIÓN DE REFERENCIA · EXISTENCIA Y CONDICIONES SE CONFIRMAN AL COTIZAR",
        42,
        footerY,
        { lineBreak: false, width: contentWidth - 70 }
      );
    document.text(`${index + 1} / ${pages.count}`, document.page.width - 90, footerY, {
      align: "right",
      lineBreak: false,
      width: 48
    });
  }

  document.end();
  return completed;
}
