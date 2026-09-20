import {
  analyzeSicoddCatalog,
  queueFullSicoddSync,
  runIncrementalSicoddSample,
  saveSicoddSettings,
  testSicoddConnection
} from "./actions";

import Link from "next/link";

import { database } from "@/lib/database";

import styles from "./page.module.css";

export const metadata = {
  robots: { index: false, follow: false },
  title: "Sincronizacion SICODD"
};

type DiagnosticLink = { label: string; path: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getInternalLinks(value: unknown): DiagnosticLink[] {
  const diagnostic = asRecord(value);
  if (!diagnostic || !Array.isArray(diagnostic.internalLinks)) return [];
  return diagnostic.internalLinks.flatMap((item) => {
    const link = asRecord(item);
    if (typeof link?.path !== "string") return [];
    return [
      {
        label: typeof link.label === "string" ? link.label : "RUTA SIN NOMBRE",
        path: link.path
      }
    ];
  });
}

function getDiagnosticMessage(value: unknown) {
  const diagnostic = asRecord(value);
  return typeof diagnostic?.message === "string" ? diagnostic.message : null;
}

function getListingCommercialData(value: unknown) {
  const source = asRecord(value);
  const listing = asRecord(source?.listing);
  if (!listing) return null;
  const costWithTax =
    typeof listing.costWithTax === "string" ? listing.costWithTax : null;
  const priceWithTax =
    typeof listing.priceWithTax === "string" ? listing.priceWithTax : null;
  const marginMultiplier =
    typeof listing.marginMultiplier === "string" ? listing.marginMultiplier : null;
  const stockByLocation = Array.isArray(listing.stockByLocation)
    ? listing.stockByLocation.flatMap((item) => {
        const stock = asRecord(item);
        return typeof stock?.quantity === "number" ? [stock.quantity] : [];
      })
    : [];
  const wholesaleTiers = Array.isArray(listing.wholesaleTiers)
    ? listing.wholesaleTiers.flatMap((item) => {
        const tier = asRecord(item);
        if (
          typeof tier?.minimumQuantity !== "number" ||
          typeof tier.priceWithTax !== "string"
        ) {
          return [];
        }
        return [
          { minimumQuantity: tier.minimumQuantity, priceWithTax: tier.priceWithTax }
        ];
      })
    : [];
  if (!costWithTax && !priceWithTax && !stockByLocation.length) return null;
  return {
    costWithTax,
    marginMultiplier,
    priceWithTax,
    stockLocations: stockByLocation.length,
    stockTotal: stockByLocation.reduce((total, quantity) => total + quantity, 0),
    wholesaleTiers
  };
}

function dateLabel(value: Date | null) {
  if (!value) return "AÚN NO HAY PRUEBA";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(value);
}

const statusLabel = {
  COMPLETED: "COMPLETADA",
  FAILED: "REVISAR",
  QUEUED: "EN COLA",
  RUNNING: "EN CURSO"
} as const;

const typeLabel = {
  CATALOG_ANALYSIS: "CATÁLOGO",
  CONNECTION_TEST: "CONEXIÓN",
  DAILY_SYNC: "DIARIA",
  SAMPLE_CAPTURE: "MUESTRA"
} as const;

export default async function SicoddSyncPage() {
  const authenticationMode = process.env.SICODD_USERNAME?.trim()
    ? "USUARIO + CONTRASEÑA"
    : "CONTRASEÑA DE ADMINISTRADOR";
  const [settings, runs, catalogFamilies] = await Promise.all([
    database.sicoddSyncSettings.findUnique({ where: { id: "sicodd-primary" } }),
    database.sicoddSyncRun.findMany({
      include: {
        candidates: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            imageUrls: true,
            name: true,
            partNumber: true,
            sourcePayload: true,
            specifications: true,
            upc: true,
            warrantyYears: true
          },
          take: 8
        },
        productRecords: {
          select: { result: true },
          take: 1
        },
        requestedBy: { select: { email: true } }
      },
      orderBy: { startedAt: "desc" },
      take: 8
    }),
    database.sicoddCatalogFamily.findMany({
      include: {
        subcategories: {
          include: { _count: { select: { products: true } } },
          orderBy: { name: "asc" }
        }
      },
      orderBy: { name: "asc" }
    })
  ]);
  const latestConnection = runs.find(
    (run) => run.type === "CONNECTION_TEST" && run.status === "COMPLETED"
  );
  const latestSample = runs.find((run) => run.type === "SAMPLE_CAPTURE");
  const latestRun = runs[0];
  const internalLinks = getInternalLinks(latestConnection?.diagnostics);
  const connectionState = settings?.lastConnectionError
    ? "REVISAR CONEXION"
    : settings?.lastConnectionAt
      ? "CONECTADO"
      : "PENDIENTE";

  return (
    <section className={styles.page}>
      <header className={styles.intro}>
        <div className={styles.introCopy}>
          <p>SUPPLY_SYSTEM / SICODD_SYNC_CONTROL</p>
          <h1>
            Sincronización
            <br />
            en muestra.
          </h1>
          <span>
            Mapea el portal del proveedor en pequeño, conserva evidencia de cada lectura y
            valida los datos antes de convertirlos en productos JANVIER.
          </span>
        </div>
        <dl className={styles.commandStatus}>
          <div data-state={settings?.lastConnectionError ? "attention" : "ready"}>
            <dt>CONEXION SICODD</dt>
            <dd>{connectionState}</dd>
            <small>{dateLabel(settings?.lastConnectionAt ?? null)}</small>
          </div>
          <div>
            <dt>ULTIMA MUESTRA</dt>
            <dd>
              {latestSample
                ? `${latestSample.candidates.length} CANDIDATOS`
                : "SIN MUESTRA"}
            </dd>
            <small>
              {latestSample ? dateLabel(latestSample.startedAt) : "AUN NO EJECUTADA"}
            </small>
          </div>
          <div>
            <dt>ULTIMA CORRIDA</dt>
            <dd>{latestRun ? statusLabel[latestRun.status] : "SIN HISTORIAL"}</dd>
            <small>{latestRun ? typeLabel[latestRun.type] : "LISTA PARA INICIAR"}</small>
          </div>
        </dl>
      </header>

      <section aria-label="Principios de la sincronización" className={styles.principles}>
        <article>
          <span>01 / LÍMITE</span>
          <strong>{settings?.sampleLimit ?? 12} ARTÍCULOS MÁXIMO</strong>
          <p>Cada ejecución de muestra se detiene exactamente en este tope.</p>
        </article>
        <article>
          <span>02 / ESTADO</span>
          <strong>NO PUBLICA NADA</strong>
          <p>Las fichas quedan como candidatos privados hasta que las revises.</p>
        </article>
        <article>
          <span>03 / ACCESO</span>
          <strong>{authenticationMode}</strong>
          <p>
            Las credenciales viven sólo en .env; nunca aparecen ni se guardan en este
            panel.
          </p>
        </article>
      </section>

      <div className={styles.grid}>
        <form action={saveSicoddSettings} className={styles.settings}>
          <div className={styles.sectionHeading}>
            <p>01 / CONFIGURAR</p>
            <h2>Perímetro de prueba</h2>
          </div>
          <label>
            <span>RUTA DEL LISTADO DE PRODUCTOS</span>
            <input
              defaultValue={settings?.productListPath ?? ""}
              name="productListPath"
              placeholder="/admin/index/productos"
              type="text"
            />
            <small>
              Se llena después de probar la conexión. Sólo se permite una ruta interna
              /admin/.
            </small>
          </label>
          <label>
            <span>ARTÍCULOS POR MUESTRA</span>
            <input
              defaultValue={settings?.sampleLimit ?? 12}
              max="50"
              min="1"
              name="sampleLimit"
              required
              type="number"
            />
            <small>
              Para empezar recomiendo 5 a 12; nunca más de 50 desde este control.
            </small>
          </label>
          <fieldset>
            <legend>PROGRAMADOR DEL PROVEEDOR</legend>
            <label className={styles.check}>
              <input
                defaultChecked={settings?.scheduleEnabled ?? false}
                name="scheduleEnabled"
                type="checkbox"
              />
              <span>
                Ejecutar un barrido incremental diario desde el trabajador del servidor
              </span>
            </label>
            <div className={styles.scheduleFields}>
              <label>
                <span>HORA (CDMX)</span>
                <input
                  defaultValue={settings?.scheduleHour ?? 2}
                  max="23"
                  min="0"
                  name="scheduleHour"
                  required
                  type="number"
                />
              </label>
              <label>
                <span>MINUTO</span>
                <input
                  defaultValue={settings?.scheduleMinute ?? 0}
                  max="59"
                  min="0"
                  name="scheduleMinute"
                  required
                  type="number"
                />
              </label>
              <label>
                <span>LÃMITE DIARIO</span>
                <input
                  defaultValue={settings?.scheduledFullSyncLimit ?? ""}
                  max="20000"
                  min="1"
                  name="scheduledFullSyncLimit"
                  placeholder="TODO EL CATÃLOGO"
                  type="number"
                />
              </label>
            </div>
            <small>
              Déjalo vacío para recorrer todas las subcategorías detectadas. El horario se
              evalúa en Ciudad de México y deja una corrida auditada en el historial.
            </small>
          </fieldset>
          <fieldset>
            <legend>ALCANCE</legend>
            <label className={styles.check}>
              <input
                defaultChecked={settings?.includeImages ?? true}
                name="includeImages"
                type="checkbox"
              />
              <span>Conservar URLs de todas las imágenes detectadas</span>
            </label>
            <div className={styles.inventoryRule}>
              <strong>INVENTARIO PRIVADO POR SUCURSAL</strong>
              <span>
                SICODD conserva cada ubicación para administración y publica solamente el
                total acumulado.
              </span>
              <Link href="/admin/ajustes/sucursales">CONFIGURAR APODOS →</Link>
            </div>
            <label className={styles.check}>
              <input
                defaultChecked={settings?.importAsDraft ?? true}
                name="importAsDraft"
                type="checkbox"
              />
              <span>Cuando se active la importación, crear siempre como borrador</span>
            </label>
          </fieldset>
          <button type="submit">GUARDAR AJUSTES</button>
        </form>

        <aside className={styles.operations}>
          <div className={styles.sectionHeading}>
            <p>02 / EJECUTAR</p>
            <h2>Primero, comprobar</h2>
          </div>
          <p>
            Última comunicación: <b>{dateLabel(settings?.lastConnectionAt ?? null)}</b>
          </p>
          {settings?.lastConnectionError ? (
            <p className={styles.error}>{settings.lastConnectionError}</p>
          ) : null}
          <form action={testSicoddConnection}>
            <button type="submit">PROBAR CONEXIÓN SICODD</button>
          </form>
          <form action={analyzeSicoddCatalog}>
            <button className={styles.secondary} type="submit">
              ANALIZAR TODAS LAS SUBCATEGORÍAS
            </button>
          </form>
          <form action={runIncrementalSicoddSample} className={styles.syncScope}>
            <fieldset>
              <legend>ACTUALIZAR EN ESTA CORRIDA</legend>
              <label className={styles.check}>
                <input defaultChecked name="updatePrices" type="checkbox" />
                <span>Precios con IVA y niveles de mayoreo</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateCosts" type="checkbox" />
                <span>Costos de proveedor</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateStock" type="checkbox" />
                <span>Existencias por sucursal y total público</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateDescriptions" type="checkbox" />
                <span>Nombre, parte, UPC, garantía y descripción</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateSpecifications" type="checkbox" />
                <span>Especificaciones técnicas</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateImages" type="checkbox" />
                <span>Galería: sólo URLs nuevas o que cambiaron</span>
              </label>
              <label className={styles.check}>
                <input defaultChecked name="updateCategories" type="checkbox" />
                <span>Familias y subfamilias del proveedor</span>
              </label>
            </fieldset>
            <label className={styles.fullLimit}>
              <span>TOPE PARA BARRIDO COMPLETO (OPCIONAL)</span>
              <input
                max="20000"
                min="1"
                name="fullSyncLimit"
                placeholder="SIN TOPE"
                type="number"
              />
            </label>
            <button className={styles.secondary} type="submit">
              EJECUTAR MUESTRA LIMITADA
            </button>
            <button formAction={queueFullSicoddSync} type="submit">
              ENVIAR BARRIDO COMPLETO A LA COLA
            </button>
          </form>
          <p className={styles.note}>
            Guardar primero. La captura no descarga el catálogo completo, no cambia
            precios y no publica productos.
          </p>
        </aside>
      </div>

      <section className={styles.taxonomy}>
        <div className={styles.sectionHeading}>
          <p>03 / TAXONOMÍA</p>
          <h2>Familias y subcategorías detectadas</h2>
        </div>
        <p className={styles.taxonomySummary}>
          {catalogFamilies.length
            ? `${catalogFamilies.length} familias · ${catalogFamilies.reduce((total, family) => total + family.subcategories.length, 0)} subcategorías · última lectura ${dateLabel(settings?.catalogAnalyzedAt ?? null)}`
            : "Aún no se analiza el árbol completo del proveedor."}
        </p>
        {catalogFamilies.length ? (
          <div className={styles.taxonomyGrid}>
            {catalogFamilies.map((family) => (
              <details key={family.id} open={family.code === "MM"}>
                <summary>
                  <span>{family.name}</span>
                  <b>{family.subcategories.length}</b>
                </summary>
                <ul>
                  {family.subcategories.map((subcategory) => (
                    <li key={subcategory.id}>
                      <span>{subcategory.name}</span>
                      <code>{subcategory.code}</code>
                      <small>{subcategory._count.products} PRODUCTOS</small>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.discovery}>
        <div className={styles.sectionHeading}>
          <p>04 / DESCUBRIR</p>
          <h2>Rutas vistas en el portal</h2>
        </div>
        {internalLinks.length ? (
          <ul>
            {internalLinks.map((link) => (
              <li key={link.path}>
                <code>{link.path}</code>
                <span>{link.label || "ENLACE INTERNO"}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>
            Prueba la conexión para que aparezcan las rutas internas disponibles. Después
            elegimos la que contiene el listado real de productos.
          </p>
        )}
      </section>

      <section className={styles.history}>
        <div className={styles.sectionHeading}>
          <p>05 / EVIDENCIA</p>
          <h2>Corridas y candidatos</h2>
        </div>
        {runs.length ? (
          <div className={styles.runs}>
            {runs.map((run) => {
              const message = getDiagnosticMessage(run.diagnostics);
              return (
                <article key={run.id}>
                  <div className={styles.runTitle}>
                    <span>{typeLabel[run.type]}</span>
                    <b data-status={run.status}>{statusLabel[run.status]}</b>
                  </div>
                  <div>
                    <p>
                      {dateLabel(run.startedAt)} ·{" "}
                      {run.requestedBy?.email ?? "PROGRAMADOR DEL SISTEMA"}
                    </p>
                    {run.productListPath ? <code>{run.productListPath}</code> : null}
                    {run.errorSummary ? (
                      <p className={styles.error}>{run.errorSummary}</p>
                    ) : null}
                    {message ? <p className={styles.runMessage}>{message}</p> : null}
                    <Link
                      className={styles.reportLink}
                      href={`/admin/sincronizacion/${run.id}`}
                    >
                      VER REPORTE DETALLADO →
                    </Link>
                  </div>
                  {run.candidates.length ? (
                    <ul className={styles.candidates}>
                      {run.candidates.map((candidate) => {
                        const commercial = getListingCommercialData(
                          candidate.sourcePayload
                        );
                        return (
                          <li key={candidate.id}>
                            <strong>
                              {candidate.name?.toUpperCase() ?? "PRODUCTO SIN NOMBRE"}
                            </strong>
                            <span>
                              PARTE {candidate.partNumber ?? "—"} · UPC{" "}
                              {candidate.upc ?? "—"} · {candidate.warrantyYears ?? "—"}{" "}
                              AÑOS
                            </span>
                            {commercial ? (
                              <span>
                                COSTO C/IVA ${commercial.costWithTax ?? "—"} · PRECIO
                                C/IVA $ {commercial.priceWithTax ?? "—"} · MARGEN{" "}
                                {commercial.marginMultiplier ?? "—"}
                              </span>
                            ) : null}
                            <small>
                              {Array.isArray(candidate.imageUrls)
                                ? candidate.imageUrls.length
                                : 0}{" "}
                              IMÁGENES ·{" "}
                              {Array.isArray(candidate.specifications)
                                ? candidate.specifications.length
                                : 0}{" "}
                              ESPECIFICACIONES
                              {commercial
                                ? ` · ${commercial.stockTotal} PZS. / ${commercial.stockLocations} UBICACIONES`
                                : ""}
                            </small>
                            {commercial?.wholesaleTiers.length ? (
                              <small>
                                MAYOREO{" "}
                                {commercial.wholesaleTiers
                                  .map(
                                    (tier) =>
                                      `${tier.minimumQuantity}+ PZS. $${tier.priceWithTax}`
                                  )
                                  .join(" · ")}
                              </small>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>
            Aún no hay ejecuciones. El primer paso seguro es probar la conexión.
          </p>
        )}
      </section>
    </section>
  );
}
