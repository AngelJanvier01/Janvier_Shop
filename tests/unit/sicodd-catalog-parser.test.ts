import { describe, expect, it } from "vitest";

import {
  extractSicoddCatalogTaxonomy,
  extractInternalAdminLinks,
  extractProductEntries,
  extractProductLinks,
  extractSicoddCsvProducts,
  inferSicoddBrand,
  parseSicoddProductPage
} from "@/lib/sicodd/catalog-parser";

const supplierOrigin = "https://janvier01.sicodd.com.mx";

describe("SICODD catalog parser", () => {
  it("recognizes TIGRE toner as its own brand rather than a compatible printer brand", () => {
    const candidate = parseSicoddProductPage(
      '<h1>TONER GENERICO TIGRE CAJA VERDE PARA BROTHER</h1>',
      `${supplierOrigin}/admin/producto/ficha/upc/1073888`
    );
    expect(candidate.brand).toBe("TIGRE");
    expect(
      inferSicoddBrand("TONER TIGRE PARA BROTHER", [
        { label: "MARCA COMPATIBLE", value: "BROTHER" }
      ])
    ).toBe("TIGRE");
  });

  it("uses the complete CSV export as a product discovery index", () => {
    const csv = [
      '"image.jpg","LPNTLVTHINKPAD","198158752190","Laptop Lenovo ThinkPad, 14"" WUXGA","LENOVO","19","21L2SAD700","22154.64"',
      '"","CNPLGRFOTOCOPIA","1065541","FOTOCOPIA","GENERICO","101","FOTOCOPIA","1.49"'
    ].join("\r\n");

    expect(extractSicoddCsvProducts(csv)).toEqual([
      {
        brand: "LENOVO",
        catalogKey: "LPNTLVTHINKPAD",
        costWithTax: "22154.64",
        label: 'Laptop Lenovo ThinkPad, 14" WUXGA',
        partNumber: "21L2SAD700",
        stockTotal: 19,
        upc: "198158752190"
      },
      {
        brand: null,
        catalogKey: "CNPLGRFOTOCOPIA",
        costWithTax: "1.49",
        label: "FOTOCOPIA",
        partNumber: "FOTOCOPIA",
        stockTotal: 101,
        upc: "1065541"
      }
    ]);
  });

  it("discovers every family and subcategory key from the supplier accordion", () => {
    const html = `
      <h3><a href="#">MEMORIAS (MM)</a></h3>
      <div><ul>
        <li><a onclick="$('#clave').val('MMDR5');Utils.filter('.filter',this.href); return false;">Memorias Ram Dimm Ddr5 (DR5)</a></li>
        <li><a onclick="$('#clave').val('MMUSB');Utils.filter('.filter',this.href); return false;">Memorias Usb (USB)</a></li>
        <li><a onclick="$('#clave').val('MM');Utils.filter('.filter',this.href); return false;">Ver Familia Completa</a></li>
      </ul></div>
      <h3><a href="#">REDES (RD)</a></h3>
      <div><ul>
        <li><a onclick="$('#clave').val('RDSW');Utils.filter('.filter',this.href); return false;">Switches (SW)</a></li>
      </ul></div>
    `;

    expect(extractSicoddCatalogTaxonomy(html)).toEqual([
      {
        code: "MM",
        name: "MEMORIAS",
        subcategories: [
          { code: "MMDR5", name: "Memorias Ram Dimm Ddr5" },
          { code: "MMUSB", name: "Memorias Usb" }
        ]
      },
      {
        code: "RD",
        name: "REDES",
        subcategories: [{ code: "RDSW", name: "Switches" }]
      }
    ]);
  });

  it("keeps only internal product links and ignores navigation", () => {
    const html = `
      <a href="/admin/index/productos">PRODUCTOS</a>
      <a href="/admin/index/ficha?id=7">GABINETE ATX</a>
      <a href="/admin/index/diccionario">DICCIONARIO</a>
      <a href="https://example.com/producto">EXTERNO</a>
    `;
    const page = `${supplierOrigin}/admin/index/productos`;

    expect(extractInternalAdminLinks(html, page)).toHaveLength(3);
    expect(extractProductLinks(html, page)).toEqual([
      { href: `${supplierOrigin}/admin/index/ficha?id=7`, label: "GABINETE ATX" }
    ]);
  });

  it("rejects product-looking navigation and export links", () => {
    const html = `
      <a href="/admin/producto">FAMILIAS</a>
      <a href="/admin/producto/list/format/csv">DESCARGAR CSV</a>
      <a href="/admin/pedido">4 PRODUCTOS</a>
    `;

    expect(extractProductEntries(html, `${supplierOrigin}/admin/producto`)).toEqual([]);
  });

  it("takes the display description from the row when the detail link only contains an icon", () => {
    const html = `
      <table><tr>
        <td>GBGCANTST10M</td>
        <td>761345102353</td>
        <td>Gabinete ANTEC ST10M, Mini Tower, Micro-ATX/ITX, Negro</td>
        <td>1.450</td><td>$ 307.05</td>
        <td><a href="/admin/producto/ficha/upc/761345102353"><img src="/images/ficha.png"></a></td>
      </tr></table>
    `;

    expect(
      extractProductLinks(html, `${supplierOrigin}/admin/producto?clave=GBGC`)
    ).toEqual([
      {
        href: `${supplierOrigin}/admin/producto/ficha/upc/761345102353`,
        label: "Gabinete ANTEC ST10M, Mini Tower, Micro-ATX/ITX, Negro"
      }
    ]);
  });

  it("maps price, wholesale tiers, and named inventory locations from a catalog row", () => {
    const html = `
      <table><thead><tr><td style="width:14px" title="Zacatecas">Zac</td><td style="width:14px" title="Guadalajara">Gua</td></tr></thead>
      <tbody><tr>
        <td><a href="/admin/producto/ficha/upc/761345102353"><img src="/productos/item.jpg"></a></td>
        <td>GBGCANTST10M <p>761345102353</p></td>
        <td>Gabinete ANTEC ST10M, Mini Tower, Negro</td>
        <td>1.450</td>
        <td>$ 307.05 <table><tr><th>5 Pzs.</th><td>$ 304.28</td></tr></table></td>
        <td>$ 445.22</td>
        <td><table><tr><td>8</td><td>6</td></tr></table></td>
      </tr></tbody></table>
    `;

    expect(
      extractProductEntries(html, `${supplierOrigin}/admin/producto?clave=GBGC`)
    ).toEqual([
      {
        costWithTax: "307.05",
        href: `${supplierOrigin}/admin/producto/ficha/upc/761345102353`,
        label: "Gabinete ANTEC ST10M, Mini Tower, Negro",
        marginMultiplier: "1.450",
        priceWithTax: "445.22",
        stockByLocation: [
          { location: "Zacatecas", quantity: 8 },
          { location: "Guadalajara", quantity: 6 }
        ],
        wholesaleTiers: [{ minimumQuantity: 5, priceWithTax: "304.28" }]
      }
    ]);
  });

  it("extracts the commercial fields and all product image URLs", () => {
    const html = `
      <h1>GABINETE ATX RGB</h1>
      <div>No Parte: AC-935753 Garantía: 2 UPC: 7506215935753</div>
      <img src="/media/ac-935753-a.jpg">
      <img src="/media/ac-935753-b.jpg">
      <img src="/assets/logo.png">
      <table>
        <tr><td>MARCA</td><td>ACTECK</td></tr>
        <tr><td>COLOR</td><td>NEGRO</td></tr>
        <tr><td>FACTOR DE FORMA</td><td>MICRO TOWER</td></tr>
      </table>
    `;

    const candidate = parseSicoddProductPage(
      html,
      `${supplierOrigin}/admin/index/ficha?id=7`
    );

    expect(candidate).toMatchObject({
      brand: "ACTECK",
      imageUrls: [
        `${supplierOrigin}/media/ac-935753-a.jpg`,
        `${supplierOrigin}/media/ac-935753-b.jpg`
      ],
      name: "GABINETE ATX RGB",
      partNumber: "AC-935753",
      sourceKey: "7506215935753",
      upc: "7506215935753",
      warrantyYears: 2
    });
    expect(candidate.specifications).toEqual([
      { label: "MARCA", value: "ACTECK" },
      { label: "COLOR", value: "NEGRO" },
      { label: "FACTOR DE FORMA", value: "MICRO TOWER" }
    ]);
  });

  it("keeps a full part number and uses each UPC as the supplier identity", () => {
    const product = (upc: string, model: string) => parseSicoddProductPage(
      `<div>No Parte: ARCHER ${model} Garantía: 1 UPC: ${upc}</div><h1>RUTEADOR TP-LINK ${model}</h1>`,
      `${supplierOrigin}/admin/producto/ficha/upc/${upc}`
    );
    const first = product("840030700019", "BE550");
    const second = product("840030700026", "AX10");
    expect(first.partNumber).toBe("ARCHER BE550");
    expect(second.partNumber).toBe("ARCHER AX10");
    expect(first.sourceKey).toBe("840030700019");
    expect(second.sourceKey).toBe("840030700026");
  });

  it("extracts paragraph and list based supplier specifications", () => {
    const candidate = parseSicoddProductPage(
      `
        <table><tr><th>No Parte: DH-XVR</th><th>Garantía: 2</th><th>UPC: 123456789</th></tr></table>
        <table><tr>
          <td><ul id="ficha_galeria"><li><img src="/productos/dh-xvr/img_1.jpg"></li></ul></td>
          <td><div>
            <h2>Principales Características</h2>
            <ul>
              <li>Detección inteligente de personas y vehículos</li>
              <li>Resolución: 4K</li>
            </ul>
            <h2>Incluye</h2>
            <ul><li>Manual de usuario</li></ul>
          </div></td>
        </tr></table>
      `,
      `${supplierOrigin}/admin/producto/ficha/upc/123456789`
    );

    expect(candidate.description).toBe(
      "Detección inteligente de personas y vehículos · Resolución: 4K · Manual de usuario"
    );
    expect(candidate.specifications).toEqual([
      {
        label: "Principales Características 1",
        value: "Detección inteligente de personas y vehículos"
      },
      { label: "Resolución", value: "4K" },
      { label: "Incluye 1", value: "Manual de usuario" }
    ]);
  });

  it("reads colon-delimited details nested inside list paragraphs", () => {
    const candidate = parseSicoddProductPage(
      `
        <table><tr><th>No Parte: STPMOA8B</th><th>Garantía: 6</th><th>UPC: 7503053078673</th></tr></table>
        <table><tr>
          <td><ul id='ficha_galeria'></ul></td>
          <td><div><ul>
            <li><p>Tipo: Mouse alámbrico óptico</p></li>
            <li><p>Marca: StyLos</p></li>
            <li><p>Resolución de sensor: 1600 DPI</p></li>
          </ul></div></td>
        </tr></table>
      `,
      `${supplierOrigin}/admin/producto/ficha/upc/7503053078673`
    );

    expect(candidate.brand).toBe("STYLOS");
    expect(candidate.specifications).toEqual([
      { label: "Tipo", value: "Mouse alámbrico óptico" },
      { label: "Marca", value: "StyLos" },
      { label: "Resolución de sensor", value: "1600 DPI" }
    ]);
  });

  it("does not use the generic specifications heading as the product name", () => {
    const candidate = parseSicoddProductPage(
      `<h2>Especificaciones</h2><table><tr><td>Marca compatible</td><td>Epson</td></tr></table>`,
      `${supplierOrigin}/admin/producto/ficha/upc/010343885325`
    );

    expect(candidate.name).toBeNull();
    expect(candidate.brand).toBeNull();
  });

  it.each([
    "Características principales",
    "Especificaciones técnicas",
    "Ficha técnica",
    "Incluye",
    "Información adicional",
    "Información técnica",
    "Parámetros del producto:",
    "Principales características",
    "Rendimiento",
    "Ventajas principales"
  ])("rejects the generic supplier heading %s", (heading) => {
    const candidate = parseSicoddProductPage(
      `<h2>${heading}</h2><table><tr><td>Color</td><td>Negro</td></tr></table>`,
      `${supplierOrigin}/admin/producto/ficha/upc/123`
    );
    expect(candidate.name).toBeNull();
  });
});
