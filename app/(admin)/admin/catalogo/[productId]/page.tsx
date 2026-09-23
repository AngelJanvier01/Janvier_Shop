import Link from "next/link";
import { notFound } from "next/navigation";

import { updateCatalogProduct } from "@/app/(admin)/admin/catalogo/actions";
import { assessCatalogQuality, catalogQualityLabels } from "@/lib/commerce/catalog-quality";
import { extractProductSpecifications } from "@/lib/commerce/product-specifications";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type ProductEditorPageProps = { params: Promise<{ productId: string }> };

function fieldNumber(value: { toString(): string } | number | null) {
  return value === null ? "" : value.toString();
}

export const metadata = {
  robots: { index: false, follow: false },
  title: "Editar producto"
};

export default async function ProductEditorPage({ params }: ProductEditorPageProps) {
  const { productId } = await params;
  const [product, families, brands] = await Promise.all([
    database.product.findUnique({
      include: { imageDerivatives: { select: { sourceUrl: true, status: true } } },
      where: { id: productId }
    }),
    database.sicoddCatalogFamily.findMany({
      include: { subcategories: { orderBy: { name: "asc" } } },
      orderBy: { name: "asc" }
    }),
    database.product.findMany({
      distinct: ["brand"],
      select: { brand: true },
      where: { brand: { not: null } },
      orderBy: { brand: "asc" }
    })
  ]);
  if (!product) notFound();
  const quality = assessCatalogQuality(product);
  const specifications = extractProductSpecifications(product.specifications)
    .map((specification) => `${specification.label}: ${specification.value}`)
    .join("\n");

  return (
    <section className={styles.page}>
      <header>
        <div>
          <Link href="/admin/catalogo">← VOLVER AL CATÁLOGO</Link>
          <p>FICHA / EDICIÓN MANUAL</p>
          <h1>{product.name}</h1>
          <span>
            Las correcciones de contenido se conservan ante futuras sincronizaciones.
            Puedes devolver cada campo al proveedor cuando lo decidas.
          </span>
        </div>
        {product.status === "PUBLISHED" ? (
          <div className={styles.headerActions}>
            <Link href={`/suministro/catalogo/${product.slug}`}>VER FICHA PÚBLICA ↗</Link>
            <Link href={`/admin/analitica?product=${encodeURIComponent(product.id)}`}>
              VER SEÑALES ↗
            </Link>
            <Link href={`/admin/catalogo/${product.id}/kardex`}>VER KARDEX ↗</Link>
          </div>
        ) : null}
      </header>

      <section className={styles.qualityPanel} aria-label="Revisión de calidad">
        <div>
          <p>REVISIÓN DE FICHA</p>
          <h2>{quality.issues.length ? `${quality.issues.length} puntos por revisar` : "Sin faltantes detectados"}</h2>
          <span>
            {product.catalogReviewApproved
              ? "Excepción aceptada por administración; los faltantes siguen visibles."
              : "Completa los datos, archiva la ficha o documenta por qué se acepta así."}
          </span>
        </div>
        {quality.issues.length ? (
          <ul className={styles.qualityTags}>
            {quality.issues.map((issue) => <li key={issue}>{catalogQualityLabels[issue]}</li>)}
          </ul>
        ) : null}
        {product.supplierSourceUrl ? (
          <a href={product.supplierSourceUrl} rel="noreferrer" target="_blank">CONSULTAR FICHA SICODD ↗</a>
        ) : null}
      </section>

      <form action={updateCatalogProduct} className={styles.form}>
        <input name="productId" type="hidden" value={product.id} />
        <input name="productUpdatedAt" type="hidden" value={product.updatedAt.toISOString()} />
        <fieldset>
          <legend>IDENTIDAD COMERCIAL</legend>
          <label>
            <span>NOMBRE</span>
            <input defaultValue={product.name} name="name" required />
          </label>
          <label>
            <span>SKU INTERNO</span>
            <input defaultValue={product.sku} name="sku" readOnly={Boolean(product.supplierSourceUrl)} required />
          </label>
          <label>
            <span>MARCA</span>
            <input defaultValue={product.brand ?? ""} list="catalog-brand-options" name="brand" />
            <datalist id="catalog-brand-options">
              {brands.flatMap(({ brand }) => brand ? [<option key={brand} value={brand} />] : [])}
            </datalist>
          </label>
          <label>
            <span>CATEGORÍA VISIBLE</span>
            <input defaultValue={product.category} name="category" required />
          </label>
          <label>
            <span>NÚMERO DE PARTE</span>
            <input defaultValue={product.partNumber ?? ""} name="partNumber" />
          </label>
          <label>
            <span>UPC</span>
            <input defaultValue={product.upc ?? ""} name="upc" readOnly={Boolean(product.supplierSourceUrl)} />
          </label>
          <label>
            <span>GARANTÍA (AÑOS)</span>
            <input
              defaultValue={fieldNumber(product.warrantyYears)}
              min="0"
              name="warrantyYears"
              type="number"
            />
          </label>
          <label>
            <span>ESTADO</span>
            <select defaultValue={product.status} name="status">
              <option value="DRAFT">BORRADOR</option>
              <option value="PUBLISHED">PUBLICADO</option>
              <option value="ARCHIVED">ARCHIVADO</option>
            </select>
          </label>
        </fieldset>
        <fieldset>
          <legend>COMERCIAL E INVENTARIO</legend>
          <label>
            <span>PRECIO BASE C/IVA</span>
            <input
              defaultValue={fieldNumber(product.basePriceWithTax)}
              min="0"
              name="basePriceWithTax"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            <span>COSTO PROVEEDOR C/IVA</span>
            <input
              defaultValue={fieldNumber(product.supplierCostWithTax)}
              min="0"
              name="supplierCostWithTax"
              step="0.01"
              type="number"
            />
          </label>
          <label>
            <span>EXISTENCIA TOTAL</span>
            <input
              defaultValue={fieldNumber(product.stockTotal)}
              min="0"
              name="stockTotal"
              step="1"
              type="number"
            />
          </label>
          <label>
            <span>CLASIFICACIÓN SICODD</span>
            <select
              defaultValue={product.supplierSubcategoryId ?? ""}
              name="supplierSubcategoryId"
            >
              <option value="">SIN ASIGNAR</option>
              {families.map((family) => (
                <optgroup key={family.id} label={family.name}>
                  {family.subcategories.map((subcategory) => (
                    <option key={subcategory.id} value={subcategory.id}>
                      {subcategory.name} / {subcategory.code}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={styles.check}>
            <input
              defaultChecked={product.specialOrder}
              name="specialOrder"
              type="checkbox"
            />
            <span>Marcar como pedido especial</span>
          </label>
        </fieldset>
        <fieldset className={styles.full}>
          <legend>CONTENIDO</legend>
          <label>
            <span>DESCRIPCIÓN</span>
            <textarea
              defaultValue={product.description}
              name="description"
              required
              rows={8}
            />
          </label>
          <label>
            <span>ESPECIFICACIONES (UNA POR LÍNEA)</span>
            <textarea defaultValue={specifications} name="specifications" rows={12} />
          </label>
        </fieldset>
        <fieldset className={styles.reviewFields}>
          <legend>DECISIÓN Y ORIGEN DE LOS DATOS</legend>
          <label className={styles.check}>
            <input defaultChecked={product.catalogReviewApproved} name="catalogReviewApproved" type="checkbox" />
            <span>Aceptar esta ficha con los faltantes señalados (requiere nota)</span>
          </label>
          <label>
            <span>NOTA DE REVISIÓN / JUSTIFICACIÓN</span>
            <textarea defaultValue={product.catalogReviewNote ?? ""} maxLength={1000} name="catalogReviewNote" rows={3} />
          </label>
          {product.manualCatalogFields.length ? (
            <div className={styles.manualFields}>
              <p>CAMPOS PROTEGIDOS DE SICODD</p>
              <span>Marca los que quieras restaurar desde SICODD en el próximo scrapeo.</span>
              {product.manualCatalogFields.map((field) => (
                <label className={styles.check} key={field}>
                  <input name="releaseSupplierFields" type="checkbox" value={field} />
                  <span>{field}</span>
                </label>
              ))}
            </div>
          ) : null}
        </fieldset>
        <footer>
          <span>
            Fuente SICODD: {product.supplierSourceUrl ? "VINCULADA" : "NO VINCULADA"}
          </span>
          <button type="submit">GUARDAR FICHA</button>
        </footer>
      </form>
    </section>
  );
}
