import PDFDocument from "pdfkit";

export type ProductInformationDocument = {
  brand: string | null;
  brandLogo?: Buffer | null;
  category: string;
  description: string;
  additionalImages?: Buffer[];
  image?: Buffer | null;
  name: string;
  partNumber: string | null;
  productUrl?: string;
  siteUrl?: string;
  sku: string;
  specialOrder: boolean;
  specifications: Array<{ label: string; value: string }>;
  stockTotal: number | null;
  consultedAt?: Date;
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
  white: "#FFFFFF"
};

const pageMargin = 36;

function upper(value: string) {
  return value.toLocaleUpperCase("es-MX");
}

function availability(product: ProductInformationDocument) {
  if (product.stockTotal !== null) {
    return {
      label: product.stockTotal > 0 ? "CON EXISTENCIAS" : "SIN EXISTENCIAS",
      value: String(product.stockTotal)
    };
  }
  if (product.specialOrder) {
    return {
      label: "BAJO PEDIDO",
      value: "BAJO PEDIDO"
    };
  }
  return {
    label: "CONSULTAR DISPONIBILIDAD",
    value: "A CONFIRMAR"
  };
}

function consultedAt(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

function websiteLabel(value: string | undefined) {
  if (!value) return "JANVIER";
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./u, "").toLocaleUpperCase("es-MX");
  } catch {
    return "JANVIER";
  }
}

function titleFontSize(
  document: PDFKit.PDFDocument,
  title: string,
  width: number,
  maximumHeight: number
) {
  for (let size = 20; size >= 12; size -= 0.5) {
    const height = document
      .font("Helvetica-Bold")
      .fontSize(size)
      .heightOfString(title, { lineGap: -1, width });
    if (height <= maximumHeight) return size;
  }
  return 12;
}

export async function createProductInformationPdf(product: ProductInformationDocument) {
  const document = new PDFDocument({
    bufferPages: true,
    info: {
      Author: "Ángel Janvier",
      Creator: "JANVIER Supply System",
      Keywords: "JANVIER, suministro tecnológico, ficha técnica",
      Subject: `Ficha técnica ${product.sku}`,
      Title: `${product.name} | JANVIER`
    },
    margin: pageMargin,
    size: "A4"
  });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  const contentWidth = document.page.width - pageMargin * 2;
  const pageBottom = document.page.height - 66;
  const productUrl = product.productUrl ?? product.siteUrl ?? "";
  const siteLabel = websiteLabel(product.siteUrl ?? product.productUrl);

  const paintPage = () => {
    document.rect(0, 0, document.page.width, document.page.height).fill(palette.paper);
    document.rect(0, 0, document.page.width, 6).fill(palette.red);
  };

  const drawHeader = (continuation = false) => {
    if (product.brandLogo) {
      try {
        document.image(product.brandLogo, pageMargin, 19, {
          fit: [92, 46],
          valign: "center"
        });
      } catch {
        document
          .fillColor(palette.ink)
          .font("Helvetica-Bold")
          .fontSize(17)
          .text("JANVIER", pageMargin, 30);
      }
    } else {
      document
        .fillColor(palette.ink)
        .font("Helvetica-Bold")
        .fontSize(17)
        .text("JANVIER", pageMargin, 30);
    }
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.6)
      .text(
        continuation ? "FICHA TÉCNICA / CONTINUACIÓN" : "FICHA TÉCNICA DE PRODUCTO",
        330,
        25,
        { align: "right", characterSpacing: 0.4, width: 229 }
      );
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(7.2)
      .text(siteLabel, 330, 39, {
        align: "right",
        characterSpacing: 0.3,
        width: 229
      });
    if (productUrl) {
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(5.8)
        .text(productUrl, 270, 52, {
          align: "right",
          ellipsis: true,
          link: productUrl,
          lineBreak: false,
          width: 289
        });
    }
    document
      .moveTo(pageMargin, 72)
      .lineTo(pageMargin + contentWidth, 72)
      .strokeColor(palette.border)
      .stroke();
  };

  const drawSpecificationHeading = (y: number, continuation = false) => {
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.5)
      .text("INFORMACIÓN TÉCNICA", pageMargin, y, { characterSpacing: 0.4 });
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(15)
      .text(
        continuation ? "ESPECIFICACIONES / CONTINUACIÓN" : "ESPECIFICACIONES",
        pageMargin,
        y + 12
      );
    return y + 38;
  };

  paintPage();
  drawHeader();

  const heroY = 88;
  const imageWidth = 198;
  const imageHeight = 202;
  document
    .rect(pageMargin, heroY, imageWidth, imageHeight)
    .fillAndStroke(palette.white, palette.border);
  if (product.image) {
    try {
      document.image(product.image, pageMargin + 12, heroY + 12, {
        align: "center",
        fit: [imageWidth - 24, imageHeight - 24],
        valign: "center"
      });
    } catch {
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(7)
        .text("IMAGEN NO DISPONIBLE", pageMargin + 12, heroY + 96, {
          align: "center",
          width: imageWidth - 24
        });
    }
  } else {
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(7)
      .text("IMAGEN EN VALIDACIÓN", pageMargin + 12, heroY + 96, {
        align: "center",
        width: imageWidth - 24
      });
  }

  const detailX = pageMargin + imageWidth + 18;
  const detailWidth = contentWidth - imageWidth - 18;
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.6)
    .text(
      `${upper(product.category)} / ${upper(product.brand ?? "MARCA A CONFIRMAR")}`,
      detailX,
      heroY,
      {
        characterSpacing: 0.35,
        width: detailWidth
      }
    );
  const titleY = heroY + 16;
  const title = upper(product.name);
  const headingSize = titleFontSize(document, title, detailWidth, 69);
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(headingSize)
    .text(title, detailX, titleY, {
      height: 69,
      lineGap: -1,
      width: detailWidth
    });
  document
    .fillColor(palette.muted)
    .font("Helvetica")
    .fontSize(7.8)
    .text(product.description, detailX, heroY + 91, {
      ellipsis: true,
      height: 47,
      lineGap: 1.5,
      width: detailWidth
    });

  const identities = [
    ["MARCA", product.brand ?? "A CONFIRMAR"],
    ["SKU", product.sku],
    ["NÚMERO DE PARTE", product.partNumber ?? "A CONFIRMAR"],
    [
      "GARANTÍA",
      product.warrantyYears
        ? `${product.warrantyYears} ${product.warrantyYears === 1 ? "AÑO" : "AÑOS"}`
        : "A CONFIRMAR"
    ]
  ];
  const identityY = heroY + 149;
  const identityColumnWidth = detailWidth / 2;
  identities.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = detailX + column * identityColumnWidth;
    const y = identityY + row * 32;
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.1)
      .text(label, x, y, {
        characterSpacing: 0.25,
        width: identityColumnWidth - 10
      });
    document
      .fillColor(palette.ink)
      .font("Helvetica")
      .fontSize(7.8)
      .text(upper(value), x, y + 11, {
        ellipsis: true,
        height: 12,
        width: identityColumnWidth - 10
      });
  });

  const stock = availability(product);
  const consultation = consultedAt(product.consultedAt ?? new Date());
  const availabilityY = heroY + imageHeight + 14;
  document
    .rect(pageMargin, availabilityY, contentWidth, 45)
    .fillAndStroke(palette.surface, palette.border);
  document.rect(pageMargin, availabilityY, 3, 45).fill(palette.red);
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(6.3)
    .text("DISPONIBILIDAD TOTAL", pageMargin + 15, availabilityY + 10, {
      characterSpacing: 0.35,
      width: 123
    });
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(16)
    .text(stock.value, pageMargin + 151, availabilityY + 8, {
      ellipsis: true,
      height: 22,
      width: 120
    });
  document
    .fillColor(palette.ink)
    .font("Helvetica-Bold")
    .fontSize(7.5)
    .text(stock.label, pageMargin + 286, availabilityY + 9, { width: 150 });
  document
    .fillColor(palette.muted)
    .font("Courier")
    .fontSize(5.9)
    .text(`CONSULTADO ${consultation}`, pageMargin + 286, availabilityY + 23, {
      characterSpacing: 0.2,
      width: 235
    });

  let y = drawSpecificationHeading(availabilityY + 64);
  const specs = product.specifications.length
    ? product.specifications
    : [{ label: "Estado", value: "Ficha en validación técnica" }];
  const columnGap = 18;
  const specificationWidth = (contentWidth - columnGap) / 2;

  const addSpecificationPage = () => {
    document.addPage();
    paintPage();
    drawHeader(true);
    return drawSpecificationHeading(88, true);
  };

  for (let index = 0; index < specs.length; index += 2) {
    const row = specs.slice(index, index + 2);
    const rowHeight = Math.max(
      31,
      ...row.map((specification) => {
        const labelHeight = document
          .font("Courier")
          .fontSize(6.2)
          .heightOfString(upper(specification.label), { width: specificationWidth });
        const valueHeight = document
          .font("Helvetica")
          .fontSize(7.7)
          .heightOfString(upper(specification.value), {
            lineGap: 1,
            width: specificationWidth
          });
        return labelHeight + valueHeight + 16;
      })
    );
    if (y + rowHeight > pageBottom) y = addSpecificationPage();
    row.forEach((specification, column) => {
      const x = pageMargin + column * (specificationWidth + columnGap);
      document
        .moveTo(x, y)
        .lineTo(x + specificationWidth, y)
        .strokeColor(palette.border)
        .stroke();
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(6.2)
        .text(upper(specification.label), x, y + 7, {
          characterSpacing: 0.2,
          width: specificationWidth
        });
      document
        .fillColor(palette.ink)
        .font("Helvetica")
        .fontSize(7.7)
        .text(upper(specification.value), x, y + 18, {
          lineGap: 1,
          width: specificationWidth
        });
    });
    y += rowHeight;
  }

  const additionalImages = product.additionalImages ?? [];
  if (additionalImages.length) {
    const galleryImageHeight = 182;
    const galleryImageWidth = (contentWidth - columnGap) / 2;
    if (y + galleryImageHeight + 64 > pageBottom) y = addSpecificationPage();
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.5)
      .text("VISTAS ADICIONALES", pageMargin, y, { characterSpacing: 0.4 });
    document
      .fillColor(palette.ink)
      .font("Helvetica-Bold")
      .fontSize(15)
      .text("IMÁGENES DEL PRODUCTO", pageMargin, y + 12);
    y += 41;

    for (let index = 0; index < additionalImages.length; index += 2) {
      if (y + galleryImageHeight > pageBottom) y = addSpecificationPage();
      additionalImages.slice(index, index + 2).forEach((image, column) => {
        const x = pageMargin + column * (galleryImageWidth + columnGap);
        document
          .rect(x, y, galleryImageWidth, galleryImageHeight)
          .fillAndStroke(palette.white, palette.border);
        try {
          document.image(image, x + 10, y + 10, {
            align: "center",
            fit: [galleryImageWidth - 20, galleryImageHeight - 20],
            valign: "center"
          });
        } catch {
          document
            .fillColor(palette.muted)
            .font("Courier")
            .fontSize(7)
            .text("IMAGEN NO DISPONIBLE", x + 12, y + galleryImageHeight / 2 - 4, {
              align: "center",
              width: galleryImageWidth - 24
            });
        }
      });
      y += galleryImageHeight + columnGap;
    }
  }

  const pages = document.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    document.switchToPage(index);
    const footerY = document.page.height - 49;
    document
      .moveTo(pageMargin, footerY - 8)
      .lineTo(pageMargin + contentWidth, footerY - 8)
      .strokeColor(palette.border)
      .stroke();
    document
      .fillColor(palette.ink)
      .font("Courier-Bold")
      .fontSize(6.2)
      .text("JANVIER / TECNOLOGÍA, SUMINISTRO E INGENIERÍA", pageMargin, footerY, {
        lineBreak: false,
        width: 265
      });
    if (productUrl) {
      document
        .fillColor(palette.muted)
        .font("Courier")
        .fontSize(5.8)
        .text(productUrl, 300, footerY, {
          align: "right",
          ellipsis: true,
          link: productUrl,
          lineBreak: false,
          width: 215
        });
    }
    document
      .fillColor(palette.muted)
      .font("Courier")
      .fontSize(6.2)
      .text(`${index + 1} / ${pages.count}`, 523, footerY, {
        align: "right",
        lineBreak: false,
        width: 36
      });
  }

  document.end();
  return completed;
}
