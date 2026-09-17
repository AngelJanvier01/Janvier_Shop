import Link from "next/link";

import {
  importSicoddCandidate,
  publishCatalogProduct
} from "@/app/(admin)/admin/catalogo/actions";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Catalogo"
};

export default async function AdminCatalogPage() {
  const [products, candidates] = await Promise.all([
    database.product.findMany({
      orderBy: { updatedAt: "desc" },
      take: 60
    }),
    database.sicoddImportCandidate.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        description: true,
        id: true,
        imageUrls: true,
        name: true,
        partNumber: true,
        upc: true,
        warrantyYears: true
      },
      take: 20,
      where: { status: "PENDING" }
    })
  ]);

  return (
    <section className={styles.page}>
      <p>SUPPLY_SYSTEM / CATALOG_CONTROL</p>
      <h1>Catalogo</h1>
      <section className={styles.review}>
        <header>
          <p>01 / REVISAR CANDIDATOS</p>
          <h2>De SICODD al catálogo, con control.</h2>
          <span>
            Asigna categoría y marca antes de crear un borrador. Se conservan galería,
            garantía, UPC, especificaciones, costos y existencias privadas.
          </span>
        </header>
        {candidates.length ? (
          <div className={styles.reviewList}>
            {candidates.map((candidate) => (
              <article key={candidate.id}>
                <div>
                  <p>
                    UPC {candidate.upc ?? "—"} · PARTE {candidate.partNumber ?? "—"}
                  </p>
                  <h3>
                    {candidate.name ?? candidate.description ?? "PRODUCTO SIN NOMBRE"}
                  </h3>
                  <span>
                    {Array.isArray(candidate.imageUrls) ? candidate.imageUrls.length : 0}{" "}
                    IMÁGENES · GARANTÍA {candidate.warrantyYears ?? "—"} AÑOS
                  </span>
                </div>
                <form action={importSicoddCandidate}>
                  <input name="candidateId" type="hidden" value={candidate.id} />
                  <label>
                    <span>CATEGORÍA / FAMILIA</span>
                    <input
                      name="category"
                      placeholder="EJ. GABINETES"
                      required
                      type="text"
                    />
                  </label>
                  <label>
                    <span>MARCA</span>
                    <input name="brand" placeholder="EJ. ACTECK" type="text" />
                  </label>
                  <button type="submit">CREAR BORRADOR</button>
                </form>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.reviewEmpty}>
            No hay candidatos pendientes. Ejecuta una muestra limitada desde
            Sincronización.
          </p>
        )}
      </section>
      <ProductCreateForm />
      {products.length ? (
        <div className={styles.list}>
          {products.map((product) => (
            <article key={product.id}>
              <div>
                <span>{product.category}</span>
                <h2>{product.name}</h2>
              </div>
              <p>{product.sku}</p>
              <b>{product.status === "PUBLISHED" ? "PUBLICADO" : "BORRADOR"}</b>
              {product.status === "PUBLISHED" ? (
                <Link href={`/suministro/catalogo/${product.slug}`}>Ver ficha</Link>
              ) : (
                <form action={publishCatalogProduct}>
                  <input name="productId" type="hidden" value={product.id} />
                  <button type="submit">Publicar</button>
                </form>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className={styles.empty}>
          <h2>Sin productos hasta validarlos.</h2>
          <p>Cada ficha publica informacion tecnica util, no precios que ya caducaron.</p>
        </section>
      )}
    </section>
  );
}
