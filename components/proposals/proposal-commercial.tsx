import type { PublicProposalCommercialDTO } from "@/lib/proposals/commercial-dto";

import styles from "./proposal-commercial.module.css";

function money(value: string, currency: string) {
  const [whole = "0", fraction = "00"] = value.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  return `${currency === "MXN" ? "$" : `${currency} `}${grouped}.${fraction}`;
}

function totals(
  totals: {
    annual: { total: string };
    monthly: { total: string };
    oneTime: { total: string };
  },
  currency: string
) {
  return (
    <dl className={styles.totals}>
      <div>
        <dt>PAGO ÚNICO</dt>
        <dd>{money(totals.oneTime.total, currency)}</dd>
      </div>
      <div>
        <dt>MENSUAL</dt>
        <dd>{money(totals.monthly.total, currency)}</dd>
      </div>
      <div>
        <dt>ANUAL</dt>
        <dd>{money(totals.annual.total, currency)}</dd>
      </div>
    </dl>
  );
}

export function ProposalOptionsComparison({
  commercial
}: {
  commercial: PublicProposalCommercialDTO;
}) {
  return (
    <section className={styles.block} data-testid="proposal-options-comparison">
      <p className={styles.eyebrow}>ALTERNATIVAS / COMPARACIÓN</p>
      <div className={styles.cards}>
        {commercial.alternatives.map((option) => (
          <article
            className={styles.option}
            data-recommended={option.recommended}
            key={option.id}
          >
            <span className={styles.tag}>
              {option.recommended ? "RECOMENDADA / " : "ALTERNATIVA / "}
              {option.code}
            </span>
            <h4>{option.title}</h4>
            {option.description ? <p>{option.description}</p> : null}
            {option.estimatedDuration ? <p>{option.estimatedDuration}</p> : null}
            {totals(option, commercial.currency)}
            {option.supportSummary ? <small>{option.supportSummary}</small> : null}
          </article>
        ))}
      </div>
    </section>
  );
}

export function ProposalLineItemsTable({
  commercial
}: {
  commercial: PublicProposalCommercialDTO;
}) {
  return (
    <section className={styles.block} data-testid="proposal-line-items-table">
      <p className={styles.eyebrow}>CONCEPTOS / ALCANCE COMERCIAL</p>
      <div className={styles.tableWrap} tabIndex={0}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Concepto</th>
              <th scope="col">Cantidad</th>
              <th scope="col">Precio</th>
              <th scope="col">Descuento</th>
              <th scope="col">Impuesto</th>
              <th scope="col">Total</th>
            </tr>
          </thead>
          <tbody>
            {commercial.lineItems.map((lineItem) => (
              <tr key={lineItem.id}>
                <td>
                  <strong>{lineItem.name}</strong>
                  {lineItem.description ? <small>{lineItem.description}</small> : null}
                  {lineItem.isIncluded ? <small>INCLUIDO</small> : null}
                  {lineItem.isOptional ? <small>OPCIONAL</small> : null}
                </td>
                <td>{`${lineItem.quantity} ${lineItem.unit}`}</td>
                <td>
                  {lineItem.isIncluded
                    ? "INCLUIDO"
                    : money(lineItem.unitPrice, commercial.currency)}
                </td>
                <td>{money(lineItem.discount, commercial.currency)}</td>
                <td>{money(lineItem.tax, commercial.currency)}</td>
                <td>
                  {lineItem.isIncluded
                    ? "INCLUIDO"
                    : money(lineItem.total, commercial.currency)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ProposalTotalsSummary({
  commercial
}: {
  commercial: PublicProposalCommercialDTO;
}) {
  const selected =
    commercial.alternatives.find((option) => option.recommended) ??
    commercial.alternatives[0];
  if (!selected) {
    return null;
  }
  return (
    <section className={styles.block} data-testid="proposal-totals-summary">
      <p className={styles.eyebrow}>RESUMEN / {selected.code}</p>
      <dl className={styles.summary}>
        <div>
          <dt>Subtotal (pago único)</dt>
          <dd>{money(selected.oneTime.subtotal, commercial.currency)}</dd>
        </div>
        <div>
          <dt>Descuentos</dt>
          <dd>{money(selected.oneTime.discount, commercial.currency)}</dd>
        </div>
        <div>
          <dt>Impuestos</dt>
          <dd>{money(selected.oneTime.tax, commercial.currency)}</dd>
        </div>
        <div>
          <dt>Total pago único</dt>
          <dd>
            <strong>{money(selected.oneTime.total, commercial.currency)}</strong>
          </dd>
        </div>
        <div>
          <dt>Mensual</dt>
          <dd>{money(selected.monthly.total, commercial.currency)}</dd>
        </div>
        <div>
          <dt>Anual</dt>
          <dd>{money(selected.annual.total, commercial.currency)}</dd>
        </div>
      </dl>
    </section>
  );
}

export function ProposalTimeline({
  commercial
}: {
  commercial: PublicProposalCommercialDTO;
}) {
  return (
    <section className={styles.block} data-testid="proposal-timeline">
      <p className={styles.eyebrow}>CRONOGRAMA / PROPUESTO</p>
      <ol className={styles.timeline}>
        {commercial.timeline.map((phase) => (
          <li key={phase.code}>
            <span className={styles.tag}>
              {phase.code} / {phase.duration}
            </span>
            <h4>{phase.title}</h4>
            {phase.description ? <p>{phase.description}</p> : null}
            {phase.dependencies.length ? (
              <p>Depende de: {phase.dependencies.join(", ")}</p>
            ) : null}
            {phase.deliverables.length ? (
              <ul>
                {phase.deliverables.map((deliverable) => (
                  <li key={deliverable.title}>{deliverable.title}</li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ProposalPaymentSchedule({
  commercial
}: {
  commercial: PublicProposalCommercialDTO;
}) {
  return (
    <section className={styles.block} data-testid="proposal-payment-schedule">
      <p className={styles.eyebrow}>ESQUEMA DE PAGOS / PROPUESTO</p>
      <dl className={styles.schedule}>
        {commercial.paymentSchedule.map((stage) => (
          <div key={`${stage.title}-${stage.optionCode ?? "common"}`}>
            <dt>
              <strong>{stage.title}</strong>
              <small>{stage.triggerDescription ?? stage.triggerType}</small>
              {stage.dueDays !== null ? <small>{`${stage.dueDays} días`}</small> : null}
            </dt>
            <dd>
              {stage.percentage ? <small>{`${stage.percentage}%`}</small> : null}
              <strong>{money(stage.amount, commercial.currency)}</strong>
            </dd>
          </div>
        ))}
      </dl>
      <p className={styles.note}>Calendario comercial propuesto, sujeto a aceptación.</p>
    </section>
  );
}
