import Link from "next/link";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type CatalogPageProps = {
  searchParams: Promise<{ category?: string; q?: string }>;
};

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catalogo tecnico",
  description:
    "Catalogo de suministro tecnico de JANVIER. La disponibilidad y el precio se validan antes de cobrar."
};

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const { category, q } = await searchParams;
  const query = q?.trim() ?? "";
  const selectedCategory = category?.trim() ?? "";
  const where = {
    category: selectedCategory || undefined,
    status: "PUBLISHED" as const,
    ...(query
      ? {
          OR: [
            { brand: { contains: query, mode: "insensitive" as const } },
            { category: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {})
  };
  const [products, categories] = await Promise.all([
    database.product.findMany({
      where,
      orderBy: [{ category: "asc" }, { name: "asc" }],
      take: 80
    }),
    database.product.findMany({
      where: { status: "PUBLISHED" },
      distinct: ["category"],
      orderBy: { category: "asc" },
      select: { category: true }
    })
  ]);

  return (
    <>
      <SiteHeader />
      <main className={styles.page}>
        <section className={styles.hero}>
          <p>SUPPLY_SYSTEM / TECHNICAL_CATALOG</p>
          <h1>Equipo con criterio antes de cotizar.</h1>
          <div>
            <span>DISPONIBILIDAD VALIDADA</span>
            <span>PRECIO SEGUN CONTEXTO</span>
            <span>RESPUESTA HUMANA</span>
          </div>
        </section>

        <form className={styles.filters} method="get">
          <label>
            <span>BUSCAR</span>
            <input
              defaultValue={query}
              name="q"
              placeholder="Producto, marca o SKU"
              type="search"
            />
          </label>
          <label>
            <span>CATEGORIA</span>
            <select defaultValue={selectedCategory} name="category">
              <option value="">Todas las categorias</option>
              {categories.map(({ category: item }) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Aplicar filtro</button>
        </form>

        <section
          className={styles.catalog}
          aria-label="Productos disponibles para solicitar"
        >
          <header>
            <p>RESULTADOS / {products.length}</p>
            <span>
              Las fichas no muestran precio: lo confirmamos con disponibilidad real.
            </span>
          </header>
          {products.length ? (
            <div className={styles.grid}>
              {products.map((product) => (
                <Link href={`/suministro/catalogo/${product.slug}`} key={product.id}>
                  <span>{product.category}</span>
                  <h2>{product.name}</h2>
                  <p>{product.description}</p>
                  <div>
                    <b>{product.brand ?? "JANVIER VERIFIED"}</b>
                    <em>{product.specialOrder ? "BAJO PEDIDO" : "SOLICITAR"}</em>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <h2>No encontramos una ficha publicada.</h2>
              <p>
                Podemos localizar equipo especial aunque aun no aparezca en el catalogo.
              </p>
              <Link href="/contacto">Solicitar abastecimiento</Link>
            </div>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
