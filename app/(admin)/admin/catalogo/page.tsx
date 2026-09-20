import { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import {
  bulkUpdateCatalogProducts,
  importSicoddCandidate,
  queueCatalogProductImages,
  removeCatalogProductImage,
  reprocessCatalogProductImage,
  reviewCatalogProductImage
} from "@/app/(admin)/admin/catalogo/actions";
import { CatalogManagementToolbar } from "@/components/admin/catalog-management-toolbar";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import {
  CatalogPublishScrollRestoration,
  PublishCatalogProductForm
} from "@/components/admin/publish-catalog-product-form";
import { getStockLocations } from "@/lib/commerce/catalog";
import { database } from "@/lib/database";
import { normalizeSicoddStockLocationName } from "@/lib/sicodd/stock-locations";

import styles from "./page.module.css";

type AdminCatalogPageProps = {
  searchParams: Promise<{
    brand?: string;
    category?: string;
    images?: string;
    page?: string;
    perPage?: string;
    q?: string;
    sort?: string;
    stock?: string;
    status?: string;
  }>;
};

const productStatusLabels = {
  ARCHIVED: "ARCHIVADO",
  DRAFT: "BORRADOR",
  PUBLISHED: "PUBLICADO"
} as const;

const processingStatuses = ["PENDING", "PROCESSING", "RETRY"] as const;
const issueStatuses = ["REJECTED", "DEAD"] as const;
const pageSizes = [25, 50, 100] as const;

const productOrder = {
  name: { name: "asc" },
  oldest: { updatedAt: "asc" },
  "price-asc": { basePriceWithTax: "asc" },
  "price-desc": { basePriceWithTax: "desc" },
  recent: { updatedAt: "desc" },
  stock: { stockTotal: "desc" }
} as const satisfies Record<string, Prisma.ProductOrderByWithRelationInput>;

type ProductSort = keyof typeof productOrder;

export const metadata = {
  robots: { index: false, follow: false },
  title: "Catálogo"
};

function normalize(value: string | undefined, limit = 100) {
  return value?.trim().slice(0, limit) ?? "";
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function pageNumbers(currentPage: number, totalPages: number) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  return [...pages]
    .filter((page) => page > 0 && page <= totalPages)
    .sort((a, b) => a - b);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  })
    .format(value)
    .toLocaleUpperCase("es-MX");
}

export default async function AdminCatalogPage({ searchParams }: AdminCatalogPageProps) {
  const params = await searchParams;
  const query = normalize(params.q);
  const brand = normalize(params.brand);
  const category = normalize(params.category);
  const status = ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(params.status ?? "")
    ? params.status!
    : "";
  const images = ["ready", "processing", "issues"].includes(params.images ?? "")
    ? params.images!
    : "";
  const stock = ["available", "zero", "unknown", "stale"].includes(params.stock ?? "")
    ? params.stock!
    : "";
  const sort = Object.hasOwn(productOrder, params.sort ?? "")
    ? (params.sort as ProductSort)
    : "recent";
  const requestedPageSize = positiveInteger(params.perPage, 50);
  const perPage = pageSizes.includes(requestedPageSize as (typeof pageSizes)[number])
    ? requestedPageSize
    : 50;
  const requestedPage = positiveInteger(params.page, 1);
  const staleStockBefore = new Date();
  staleStockBefore.setHours(staleStockBefore.getHours() - 36);
  const conditions: Prisma.ProductWhereInput[] = [];

  if (query) {
    conditions.push({
      OR: [
        { brand: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { name: { contains: query, mode: "insensitive" } },
        { partNumber: { contains: query, mode: "insensitive" } },
        { sku: { contains: query, mode: "insensitive" } },
        { upc: { contains: query, mode: "insensitive" } }
      ]
    });
  }
  if (brand) conditions.push({ brand: { contains: brand, mode: "insensitive" } });
  if (category) {
    conditions.push({ category: { contains: category, mode: "insensitive" } });
  }
  if (stock === "available") conditions.push({ stockTotal: { gt: 0 } });
  if (stock === "zero") conditions.push({ stockTotal: 0 });
  if (stock === "unknown") conditions.push({ stockTotal: null });
  if (stock === "stale") {
    conditions.push({
      OR: [{ stockUpdatedAt: null }, { stockUpdatedAt: { lt: staleStockBefore } }]
    });
  }

  const where: Prisma.ProductWhereInput = {
    status: status ? (status as "PUBLISHED" | "DRAFT" | "ARCHIVED") : undefined,
    AND: conditions.length ? conditions : undefined,
    imageDerivatives:
      images === "ready"
        ? { some: { status: "READY" } }
        : images === "processing"
          ? { some: { status: { in: [...processingStatuses] } } }
          : images === "issues"
            ? { some: { status: { in: [...issueStatuses] } } }
            : undefined
  };
  const resultCount = await database.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(resultCount / perPage));
  const currentPage = Math.min(requestedPage, totalPages);

  const [
    products,
    candidates,
    warehouseDirectory,
    statusCounts,
    readyImageCount,
    pendingCandidateCount
  ] = await Promise.all([
    database.product.findMany({
      select: {
        brand: true,
        category: true,
        id: true,
        imageUrl: true,
        imageDerivatives: {
          orderBy: { sourcePosition: "asc" },
          select: {
            attempts: true,
            id: true,
            lastErrorCode: true,
            maxAttempts: true,
            modelName: true,
            processingVersion: true,
            sourcePosition: true,
            sourceUrl: true,
            status: true,
            storageKey: true
          },
          take: 17
        },
        name: true,
        sku: true,
        slug: true,
        status: true,
        stockByLocation: true,
        stockTotal: true,
        stockUpdatedAt: true,
        updatedAt: true
      },
      orderBy: productOrder[sort],
      skip: (currentPage - 1) * perPage,
      take: perPage,
      where
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
    }),
    database.sicoddWarehouse.findMany({
      select: { nickname: true, normalizedName: true, sourceName: true }
    }),
    database.product.groupBy({
      by: ["status"],
      _count: { _all: true }
    }),
    database.productImageDerivative.count({ where: { status: "READY" } }),
    database.sicoddImportCandidate.count({ where: { status: "PENDING" } })
  ]);
  const productCountsByStatus = new Map(
    statusCounts.map((entry) => [entry.status, entry._count._all])
  );
  const publishedCount = productCountsByStatus.get("PUBLISHED") ?? 0;
  const draftCount = productCountsByStatus.get("DRAFT") ?? 0;
  const archivedCount = productCountsByStatus.get("ARCHIVED") ?? 0;
  const paginationParams = new URLSearchParams();
  if (query) paginationParams.set("q", query);
  if (brand) paginationParams.set("brand", brand);
  if (category) paginationParams.set("category", category);
  if (status) paginationParams.set("status", status);
  if (images) paginationParams.set("images", images);
  if (stock) paginationParams.set("stock", stock);
  if (sort !== "recent") paginationParams.set("sort", sort);
  if (perPage !== 50) paginationParams.set("perPage", String(perPage));
  const pageHref = (page: number) => {
    const next = new URLSearchParams(paginationParams);
    if (page > 1) next.set("page", String(page));
    const encoded = next.toString();
    return encoded ? `/admin/catalogo?${encoded}` : "/admin/catalogo";
  };
  const warehouseByName = new Map(
    warehouseDirectory.map((warehouse) => [warehouse.normalizedName, warehouse])
  );
  const publishScrollSignature = `${publishedCount}:${draftCount}:${products
    .map((product) => `${product.id}:${product.status}:${product.updatedAt.getTime()}`)
    .join("|")}`;

  return (
    <section className={styles.page}>
      <CatalogPublishScrollRestoration signature={publishScrollSignature} />
      <header className={styles.pageHeader}>
        <div>
          <p>SUPPLY_SYSTEM / CATALOG_CONTROL</p>
          <h1>Catálogo</h1>
          <span>
            Publica fichas, revisa imágenes y encuentra cualquier producto sin perder
            contexto.
          </span>
        </div>
        <a href="#nueva-ficha">NUEVA FICHA +</a>
      </header>

      <dl className={styles.metrics}>
        <div>
          <dt>PUBLICADOS</dt>
          <dd>{publishedCount}</dd>
        </div>
        <div>
          <dt>BORRADORES</dt>
          <dd>{draftCount}</dd>
        </div>
        <div>
          <dt>ARCHIVADOS</dt>
          <dd>{archivedCount}</dd>
        </div>
        <div>
          <dt>IMÁGENES POR REVISAR</dt>
          <dd>{readyImageCount}</dd>
        </div>
        <div>
          <dt>CANDIDATOS SICODD</dt>
          <dd>{pendingCandidateCount}</dd>
        </div>
      </dl>

      <details className={styles.createPanel} id="nueva-ficha">
        <summary>
          <span>NUEVA FICHA MANUAL</span>
          <b>ABRIR FORMULARIO +</b>
        </summary>
        <ProductCreateForm />
      </details>

      <details className={styles.candidatePanel}>
        <summary>
          <span>CANDIDATOS DE SICODD</span>
          <b>
            {candidates.length ? `${candidates.length} POR REVISAR` : "SIN PENDIENTES"}
          </b>
        </summary>
        <div className={styles.candidateIntro}>
          <h2>De SICODD al catálogo, con control.</h2>
          <p>
            Asigna categoría y marca antes de crear el borrador; los datos técnicos se
            conservan.
          </p>
        </div>
        {candidates.length ? (
          <div className={styles.candidateList}>
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
                    IMÁGENES
                    {" · "}GARANTÍA {candidate.warrantyYears ?? "—"} AÑOS
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
          <p className={styles.candidateEmpty}>No hay candidatos pendientes.</p>
        )}
      </details>

      <CatalogManagementToolbar
        brand={brand}
        category={category}
        images={images}
        perPage={perPage}
        query={query}
        resultCount={resultCount}
        sort={sort}
        stock={stock}
        status={status}
      />

      {products.length ? (
        <form
          action={bulkUpdateCatalogProducts}
          className={styles.bulkActions}
          id="catalog-bulk-form"
        >
          <p>
            OPERACIÓN POR LOTE / SELECCIONA FICHAS DE ESTA PÁGINA Y APLICA UN CAMBIO
            REVERSIBLE.
          </p>
          <label>
            <span>CAMBIAR ESTADO A</span>
            <select defaultValue="" name="status">
              <option disabled value="">
                Selecciona una acción
              </option>
              <option value="PUBLISHED">Publicar y aprobar imágenes listas</option>
              <option value="DRAFT">Mover a borrador</option>
              <option value="ARCHIVED">Archivar (sin borrar)</option>
            </select>
          </label>
          <button type="submit">APLICAR A LA SELECCIÓN</button>
        </form>
      ) : null}

      {products.length ? (
        <section className={styles.productTable} aria-label="Productos del catálogo">
          <header className={styles.tableHeader}>
            <span aria-hidden="true">SEL.</span>
            <span>PRODUCTO</span>
            <span>SKU</span>
            <span>ESTADO</span>
            <span>EXISTENCIAS</span>
            <span>IMÁGENES</span>
            <span>ACTUALIZADO</span>
            <span>ACCIÓN</span>
          </header>
          {products.map((product) => {
            const readyCount = product.imageDerivatives.filter(
              (image) => image.status === "READY"
            ).length;
            const approvedCount = product.imageDerivatives.filter(
              (image) => image.status === "APPROVED"
            ).length;
            const activeCount = product.imageDerivatives.filter((image) =>
              processingStatuses.includes(
                image.status as (typeof processingStatuses)[number]
              )
            ).length;
            const issueCount = product.imageDerivatives.filter((image) =>
              issueStatuses.includes(image.status as (typeof issueStatuses)[number])
            ).length;
            const stockLocations = getStockLocations(product.stockByLocation);

            return (
              <article
                className={styles.productRow}
                data-product-row
                id={`catalog-product-${product.id}`}
                key={product.id}
              >
                <label className={styles.productSelection}>
                  <input
                    aria-label={`Seleccionar ${product.name}`}
                    form="catalog-bulk-form"
                    name="productIds"
                    type="checkbox"
                    value={product.id}
                  />
                </label>
                <div className={styles.productIdentity}>
                  <div className={styles.productThumb}>
                    {product.imageUrl ? (
                      // Imagen fuente para reconocer el producto rápidamente.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt=""
                        decoding="async"
                        loading="lazy"
                        src={product.imageUrl}
                      />
                    ) : (
                      <span>∅</span>
                    )}
                  </div>
                  <div>
                    <span>
                      {product.category}
                      {product.brand ? ` / ${product.brand}` : ""}
                    </span>
                    <h2>{product.name}</h2>
                  </div>
                </div>
                <code>{product.sku}</code>
                <b data-status={product.status}>{productStatusLabels[product.status]}</b>
                <div
                  className={styles.stockSummary}
                  data-empty={product.stockTotal === null}
                >
                  <strong>{product.stockTotal ?? "—"}</strong>
                  <span>{product.stockTotal === null ? "SIN LECTURA" : "TOTAL"}</span>
                  {product.stockUpdatedAt ? (
                    <time dateTime={product.stockUpdatedAt.toISOString()}>
                      {formatDateTime(product.stockUpdatedAt)}
                    </time>
                  ) : null}
                </div>
                <span className={styles.imageSummary}>
                  {approvedCount} APROBADAS
                  {readyCount ? ` · ${readyCount} POR REVISAR` : ""}
                  {activeCount ? ` · ${activeCount} EN PROCESO` : ""}
                  {issueCount ? ` · ${issueCount} INCIDENCIAS` : ""}
                </span>
                <time dateTime={product.updatedAt.toISOString()}>
                  {formatDateTime(product.updatedAt)}
                </time>
                <div className={styles.rowAction}>
                  <Link href={`/admin/catalogo/${product.id}`}>EDITAR FICHA</Link>
                  <Link href={`/admin/catalogo/${product.id}/kardex`}>KARDEX</Link>
                  {product.status === "PUBLISHED" ? (
                    <Link href={`/suministro/catalogo/${product.slug}`}>VER FICHA ↗</Link>
                  ) : product.status === "DRAFT" ? (
                    <PublishCatalogProductForm productId={product.id} />
                  ) : (
                    <span>ARCHIVADO</span>
                  )}
                </div>

                <details className={styles.stockPanel}>
                  <summary>
                    <span>EXISTENCIAS POR SUCURSAL / {stockLocations.length}</span>
                    <b>
                      {product.stockUpdatedAt
                        ? `ACTUALIZADO ${formatDateTime(product.stockUpdatedAt)}`
                        : "PENDIENTE DE SINCRONIZAR"}
                    </b>
                  </summary>
                  {stockLocations.length ? (
                    <div className={styles.stockGrid}>
                      {stockLocations.map((stock) => {
                        const warehouse = warehouseByName.get(
                          normalizeSicoddStockLocationName(stock.location)
                        );
                        const nickname = warehouse?.nickname ?? stock.location;
                        return (
                          <article key={normalizeSicoddStockLocationName(stock.location)}>
                            <div>
                              <strong>{nickname}</strong>
                              {nickname !== stock.location ? (
                                <span>SICODD / {stock.location}</span>
                              ) : null}
                            </div>
                            <b>{stock.quantity}</b>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <p className={styles.noStock}>
                      Este producto todavía no tiene una lectura de inventario guardada.
                    </p>
                  )}
                </details>

                <details className={styles.imagePipeline}>
                  <summary>
                    <span>GESTIONAR IMÁGENES / {product.imageDerivatives.length}</span>
                    <b>
                      {readyCount
                        ? `${readyCount} REQUIEREN REVISIÓN`
                        : "ABRIR BANDEJA +"}
                    </b>
                  </summary>
                  <div className={styles.pipelineControls}>
                    <p>
                      Procesa nuevas fuentes o revisa cada recorte antes de publicarlo.
                    </p>
                    <form action={queueCatalogProductImages}>
                      <input name="productId" type="hidden" value={product.id} />
                      <button type="submit">PREPARAR IMÁGENES</button>
                    </form>
                  </div>
                  {product.imageDerivatives.length ? (
                    <div className={styles.imageJobs}>
                      {product.imageDerivatives.map((image) => (
                        <article key={image.id}>
                          {image.storageKey &&
                          ["READY", "APPROVED"].includes(image.status) ? (
                            // Derivado local generado por el servicio de segmentación.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={`Vista procesada de ${product.name}`}
                              decoding="async"
                              loading="lazy"
                              src={`/api/product-images/${image.id}/webp?v=${image.processingVersion}`}
                            />
                          ) : (
                            <div>{image.status}</div>
                          )}
                          <p>
                            {image.status} · INTENTO {image.attempts}/{image.maxAttempts}
                          </p>
                          {image.lastErrorCode ? <em>{image.lastErrorCode}</em> : null}
                          {image.modelName === "SOURCE_PNG_WITH_ALPHA" ? (
                            <em>PNG CON ALFA ORIGINAL · REVISIÓN REQUERIDA</em>
                          ) : null}
                          {["READY", "APPROVED"].includes(image.status) ? (
                            <form action={reviewCatalogProductImage}>
                              <input name="assetId" type="hidden" value={image.id} />
                              {image.status === "READY" ? (
                                <button name="decision" type="submit" value="APPROVED">
                                  APROBAR
                                </button>
                              ) : null}
                              <button name="decision" type="submit" value="REJECTED">
                                {image.status === "APPROVED" ? "RETIRAR" : "RECHAZAR"}
                              </button>
                            </form>
                          ) : null}
                          <form action={removeCatalogProductImage}>
                            <input name="assetId" type="hidden" value={image.id} />
                            <input
                              name="reason"
                              type="hidden"
                              value="DUPLICADA O DESCARTADA POR ADMINISTRACIÃ“N"
                            />
                            <button type="submit">ELIMINAR Y EXCLUIR</button>
                          </form>
                          {["DEAD", "REJECTED", "APPROVED"].includes(image.status) ? (
                            <form action={reprocessCatalogProductImage}>
                              <input name="assetId" type="hidden" value={image.id} />
                              <button type="submit">REPROCESAR</button>
                            </form>
                          ) : null}
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.noImages}>SIN TRABAJOS DE IMAGEN.</p>
                  )}
                </details>
              </article>
            );
          })}
        </section>
      ) : (
        <section className={styles.empty}>
          <h2>No encontramos productos con esos filtros.</h2>
          <p>Limpia la búsqueda para volver a ver el catálogo completo.</p>
        </section>
      )}

      {resultCount > perPage ? (
        <nav aria-label="Paginación del catálogo" className={styles.pagination}>
          <span>
            MOSTRANDO {(currentPage - 1) * perPage + 1}–
            {Math.min(currentPage * perPage, resultCount)} DE {resultCount} / PÁGINA{" "}
            {currentPage}
            DE {totalPages}
          </span>
          <div>
            {currentPage > 1 ? (
              <Link href={pageHref(currentPage - 1)}>ANTERIOR</Link>
            ) : null}
            {pageNumbers(currentPage, totalPages).map((page, index, pages) => (
              <span className={styles.paginationPage} key={page}>
                {index > 0 && page - pages[index - 1] > 1 ? <i>…</i> : null}
                {page === currentPage ? (
                  <b aria-current="page">{page}</b>
                ) : (
                  <Link href={pageHref(page)}>{page}</Link>
                )}
              </span>
            ))}
            {currentPage < totalPages ? (
              <Link href={pageHref(currentPage + 1)}>SIGUIENTE</Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
