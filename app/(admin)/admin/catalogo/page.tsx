import { Prisma } from "@/app/generated/prisma/client";
import Link from "next/link";

import {
  importSicoddCandidate,
  queueCatalogProductImages,
  reprocessCatalogProductImage,
  reviewCatalogProductImage
} from "@/app/(admin)/admin/catalogo/actions";
import { CatalogManagementToolbar } from "@/components/admin/catalog-management-toolbar";
import { ProductCreateForm } from "@/components/admin/product-create-form";
import {
  CatalogPublishScrollRestoration,
  PublishCatalogProductForm
} from "@/components/admin/publish-catalog-product-form";
import { database } from "@/lib/database";

import styles from "./page.module.css";

type AdminCatalogPageProps = {
  searchParams: Promise<{
    images?: string;
    q?: string;
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

export const metadata = {
  robots: { index: false, follow: false },
  title: "Catálogo"
};

function normalize(value: string | undefined, limit = 100) {
  return value?.trim().slice(0, limit) ?? "";
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

export default async function AdminCatalogPage({ searchParams }: AdminCatalogPageProps) {
  const params = await searchParams;
  const query = normalize(params.q);
  const status = ["PUBLISHED", "DRAFT", "ARCHIVED"].includes(params.status ?? "")
    ? params.status!
    : "";
  const images = ["ready", "processing", "issues"].includes(params.images ?? "")
    ? params.images!
    : "";

  const where: Prisma.ProductWhereInput = {
    status: status ? (status as "PUBLISHED" | "DRAFT" | "ARCHIVED") : undefined,
    ...(query
      ? {
          OR: [
            { brand: { contains: query, mode: "insensitive" as const } },
            { category: { contains: query, mode: "insensitive" as const } },
            { name: { contains: query, mode: "insensitive" as const } },
            { partNumber: { contains: query, mode: "insensitive" as const } },
            { sku: { contains: query, mode: "insensitive" as const } },
            { upc: { contains: query, mode: "insensitive" as const } }
          ]
        }
      : {}),
    imageDerivatives:
      images === "ready"
        ? { some: { status: "READY" } }
        : images === "processing"
          ? { some: { status: { in: [...processingStatuses] } } }
          : images === "issues"
            ? { some: { status: { in: [...issueStatuses] } } }
            : undefined
  };

  const [
    products,
    candidates,
    publishedCount,
    draftCount,
    readyImageCount,
    pendingCandidateCount,
    resultCount
  ] = await Promise.all([
    database.product.findMany({
      include: {
        imageDerivatives: { orderBy: { sourcePosition: "asc" }, take: 17 }
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
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
    database.product.count({ where: { status: "PUBLISHED" } }),
    database.product.count({ where: { status: "DRAFT" } }),
    database.productImageDerivative.count({ where: { status: "READY" } }),
    database.sicoddImportCandidate.count({ where: { status: "PENDING" } }),
    database.product.count({ where })
  ]);
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
          <span>Publica fichas, revisa imágenes y encuentra cualquier producto sin perder contexto.</span>
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

      <details className={styles.candidatePanel} open={Boolean(candidates.length)}>
        <summary>
          <span>CANDIDATOS DE SICODD</span>
          <b>{candidates.length ? `${candidates.length} POR REVISAR` : "SIN PENDIENTES"}</b>
        </summary>
        <div className={styles.candidateIntro}>
          <h2>De SICODD al catálogo, con control.</h2>
          <p>Asigna categoría y marca antes de crear el borrador; los datos técnicos se conservan.</p>
        </div>
        {candidates.length ? (
          <div className={styles.candidateList}>
            {candidates.map((candidate) => (
              <article key={candidate.id}>
                <div>
                  <p>UPC {candidate.upc ?? "—"} · PARTE {candidate.partNumber ?? "—"}</p>
                  <h3>{candidate.name ?? candidate.description ?? "PRODUCTO SIN NOMBRE"}</h3>
                  <span>
                    {Array.isArray(candidate.imageUrls) ? candidate.imageUrls.length : 0} IMÁGENES
                    {" · "}GARANTÍA {candidate.warrantyYears ?? "—"} AÑOS
                  </span>
                </div>
                <form action={importSicoddCandidate}>
                  <input name="candidateId" type="hidden" value={candidate.id} />
                  <label>
                    <span>CATEGORÍA / FAMILIA</span>
                    <input name="category" placeholder="EJ. GABINETES" required type="text" />
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
        images={images}
        query={query}
        resultCount={resultCount}
        status={status}
      />

      {products.length ? (
        <section className={styles.productTable} aria-label="Productos del catálogo">
          <header className={styles.tableHeader}>
            <span>PRODUCTO</span>
            <span>SKU</span>
            <span>ESTADO</span>
            <span>IMÁGENES</span>
            <span>ACTUALIZADO</span>
            <span>ACCIÓN</span>
          </header>
          {products.map((product) => {
            const readyCount = product.imageDerivatives.filter((image) => image.status === "READY").length;
            const approvedCount = product.imageDerivatives.filter((image) => image.status === "APPROVED").length;
            const activeCount = product.imageDerivatives.filter((image) =>
              processingStatuses.includes(image.status as (typeof processingStatuses)[number])
            ).length;
            const issueCount = product.imageDerivatives.filter((image) =>
              issueStatuses.includes(image.status as (typeof issueStatuses)[number])
            ).length;

            return (
              <article
                className={styles.productRow}
                data-product-row
                id={`catalog-product-${product.id}`}
                key={product.id}
              >
                <div className={styles.productIdentity}>
                  <div className={styles.productThumb}>
                    {product.imageUrl ? (
                      // Imagen fuente para reconocer el producto rápidamente.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt="" src={product.imageUrl} />
                    ) : (
                      <span>∅</span>
                    )}
                  </div>
                  <div>
                    <span>{product.category}{product.brand ? ` / ${product.brand}` : ""}</span>
                    <h2>{product.name}</h2>
                  </div>
                </div>
                <code>{product.sku}</code>
                <b data-status={product.status}>{productStatusLabels[product.status]}</b>
                <span className={styles.imageSummary}>
                  {approvedCount} APROBADAS
                  {readyCount ? ` · ${readyCount} POR REVISAR` : ""}
                  {activeCount ? ` · ${activeCount} EN PROCESO` : ""}
                  {issueCount ? ` · ${issueCount} INCIDENCIAS` : ""}
                </span>
                <time dateTime={product.updatedAt.toISOString()}>{formatDate(product.updatedAt)}</time>
                <div className={styles.rowAction}>
                  {product.status === "PUBLISHED" ? (
                    <Link href={`/suministro/catalogo/${product.slug}`}>VER FICHA ↗</Link>
                  ) : product.status === "DRAFT" ? (
                    <PublishCatalogProductForm productId={product.id} />
                  ) : (
                    <span>ARCHIVADO</span>
                  )}
                </div>

                <details className={styles.imagePipeline}>
                  <summary>
                    <span>GESTIONAR IMÁGENES / {product.imageDerivatives.length}</span>
                    <b>{readyCount ? `${readyCount} REQUIEREN REVISIÓN` : "ABRIR BANDEJA +"}</b>
                  </summary>
                  <div className={styles.pipelineControls}>
                    <p>Procesa nuevas fuentes o revisa cada recorte antes de publicarlo.</p>
                    <form action={queueCatalogProductImages}>
                      <input name="productId" type="hidden" value={product.id} />
                      <button type="submit">PREPARAR IMÁGENES</button>
                    </form>
                  </div>
                  {product.imageDerivatives.length ? (
                    <div className={styles.imageJobs}>
                      {product.imageDerivatives.map((image) => (
                        <article key={image.id}>
                          {image.storageKey && ["READY", "APPROVED"].includes(image.status) ? (
                            // Derivado local generado por el servicio de segmentación.
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              alt={`Vista procesada de ${product.name}`}
                              src={`/api/product-images/${image.id}/webp?v=${image.processingVersion}`}
                            />
                          ) : (
                            <div>{image.status}</div>
                          )}
                          <p>{image.status} · INTENTO {image.attempts}/{image.maxAttempts}</p>
                          {image.lastErrorCode ? <em>{image.lastErrorCode}</em> : null}
                          {image.modelName === "SOURCE_PNG_PASSTHROUGH" ? (
                            <em>PNG ORIGINAL · APROBACIÓN AUTOMÁTICA</em>
                          ) : null}
                          {["READY", "APPROVED"].includes(image.status) ? (
                            <form action={reviewCatalogProductImage}>
                              <input name="assetId" type="hidden" value={image.id} />
                              {image.status === "READY" ? (
                                <button name="decision" type="submit" value="APPROVED">APROBAR</button>
                              ) : null}
                              <button name="decision" type="submit" value="REJECTED">
                                {image.status === "APPROVED" ? "RETIRAR" : "RECHAZAR"}
                              </button>
                            </form>
                          ) : null}
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
    </section>
  );
}
