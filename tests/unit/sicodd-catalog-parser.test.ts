import { describe, expect, it } from "vitest";

import {
  extractSicoddCatalogTaxonomy,
  extractInternalAdminLinks,
  extractProductEntries,
  extractProductLinks,
  parseSicoddProductPage
} from "@/lib/sicodd/catalog-parser";

const supplierOrigin = "https://janvier01.sicodd.com.mx";

describe("SICODD catalog parser", () => {
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
        <tr><td>COLOR</td><td>NEGRO</td></tr>
        <tr><td>FACTOR DE FORMA</td><td>MICRO TOWER</td></tr>
      </table>
    `;

    const candidate = parseSicoddProductPage(
      html,
      `${supplierOrigin}/admin/index/ficha?id=7`
    );

    expect(candidate).toMatchObject({
      imageUrls: [
        `${supplierOrigin}/media/ac-935753-a.jpg`,
        `${supplierOrigin}/media/ac-935753-b.jpg`
      ],
      name: "GABINETE ATX RGB",
      partNumber: "AC-935753",
      upc: "7506215935753",
      warrantyYears: 2
    });
    expect(candidate.specifications).toEqual([
      { label: "COLOR", value: "NEGRO" },
      { label: "FACTOR DE FORMA", value: "MICRO TOWER" }
    ]);
  });
});
