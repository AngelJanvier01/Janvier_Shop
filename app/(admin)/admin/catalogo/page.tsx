import Link from "next/link";

import { ProductCreateForm } from "@/components/admin/product-create-form";
import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Catalogo"
};

export default async function AdminCatalogPage() {
  const products = await database.product.findMany({
    orderBy: { updatedAt: "desc" },
    take: 40
  });

  return (
    <section className={styles.page}>
      <p>SUPPLY_SYSTEM / CATALOG_CONTROL</p>
      <h1>Catalogo</h1>
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
              <b>{product.status}</b>
              {product.status === "PUBLISHED" ? (
                <Link href={`/suministro/catalogo/${product.slug}`}>Ver ficha</Link>
              ) : null}
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
