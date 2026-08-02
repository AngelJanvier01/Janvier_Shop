"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";

import {
  saveCommercialProposalData,
  type CommercialProposalActionState
} from "@/app/(admin)/admin/propuestas/commercial-actions";
import type { CommercialRevisionInput } from "@/lib/proposals/commercial-validation";

import styles from "./proposal-commercial-studio.module.css";

type Draft<T> = T & { key: string };

type CommercialStudioInitial = Omit<
  CommercialRevisionInput,
  "expectedCommercialVersion"
> & {
  commercialVersion: number;
};

type ProposalCommercialStudioProps = {
  initial: CommercialStudioInitial;
  revisionId: string;
};

const initialState: CommercialProposalActionState = {};

function key(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function draft<T>(prefix: string, value: T): Draft<T> {
  return { ...value, key: key(prefix) };
}

function withoutKey<T>(item: Draft<T>): T {
  const { key, ...value } = item;
  void key;
  return value as T;
}

function move<T>(items: T[], index: number, direction: -1 | 1) {
  const next = index + direction;
  if (next < 0 || next >= items.length) {
    return items;
  }
  const copy = [...items];
  [copy[index], copy[next]] = [copy[next]!, copy[index]!];
  return copy;
}

function addOption() {
  return draft("option", {
    code: "CORE",
    conditionsSummary: null,
    description: null,
    estimatedDuration: null,
    isActive: true,
    recommended: false,
    supportSummary: null,
    title: "Alternativa CORE"
  });
}

function addLineItem() {
  return draft("line", {
    billingType: "ONE_TIME" as const,
    code: "CONCEPTO",
    contingencyPercent: null,
    description: null,
    discountType: "NONE" as const,
    discountValue: "0",
    internalCost: null,
    internalNotes: null,
    isActive: true,
    isIncluded: false,
    isOptional: false,
    isTaxable: true,
    markupPercent: null,
    name: "Nuevo concepto",
    optionCode: null,
    pricingMode: "MANUAL" as const,
    quantity: "1",
    scope: "COMMON" as const,
    selectedByDefault: false,
    supplier: null,
    supplierReference: null,
    taxIncluded: false,
    taxRate: "16",
    unit: "service",
    unitPrice: "0",
    visibleToClient: true
  });
}

function addPhase() {
  return draft("phase", {
    code: "DISCOVERY",
    dependsOnCodes: [],
    deliverables: [],
    description: null,
    durationUnit: "WEEK" as const,
    durationValue: 1,
    estimatedEndDate: null,
    estimatedStartDate: null,
    isOptional: false,
    optionCode: null,
    title: "Nueva fase",
    visibleToClient: true
  });
}

function addPaymentStage() {
  return draft("payment", {
    calculationType: "PERCENTAGE" as const,
    description: null,
    dueDays: null,
    fixedAmount: null,
    optionCode: null,
    percentage: "0",
    title: "Nueva etapa",
    triggerDescription: null,
    triggerType: "ACCEPTANCE" as const,
    visibleToClient: true
  });
}

export function ProposalCommercialStudio({
  initial,
  revisionId
}: ProposalCommercialStudioProps) {
  const action = saveCommercialProposalData.bind(null, revisionId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [options, setOptions] = useState(() =>
    initial.options.map((item) => draft("option", item))
  );
  const [lineItems, setLineItems] = useState(() =>
    initial.lineItems.map((item) => draft("line", item))
  );
  const [timelinePhases, setTimelinePhases] = useState(() =>
    initial.timelinePhases.map((item) => draft("phase", item))
  );
  const [paymentStages, setPaymentStages] = useState(() =>
    initial.paymentStages.map((item) => draft("payment", item))
  );
  const [terms, setTerms] = useState(() => ({
    currency: initial.currency,
    deliveryTerms: initial.deliveryTerms,
    paymentTermsSummary: initial.paymentTermsSummary,
    supportSummary: initial.supportSummary,
    taxDisplayMode: initial.taxDisplayMode,
    validUntil: initial.validUntil,
    warrantySummary: initial.warrantySummary
  }));
  const [revision, setRevision] = useState(0);
  const [acknowledgedRevision, setAcknowledgedRevision] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const currentRevisionRef = useRef(0);

  const optionCodes = useMemo(() => options.map((option) => option.code), [options]);
  const currentCommercialVersion = state.commercialVersion ?? initial.commercialVersion;
  const status = state.conflict
    ? "CONFLICT"
    : isPending
      ? "SAVING"
      : revision > acknowledgedRevision
        ? "PENDING"
        : state.error
          ? "ERROR"
          : "SAVED";

  function changed() {
    currentRevisionRef.current += 1;
    setRevision(currentRevisionRef.current);
  }

  useEffect(() => {
    if (revision <= acknowledgedRevision || isPending || state.conflict || state.error) {
      return;
    }
    const timeout = window.setTimeout(() => formRef.current?.requestSubmit(), 1200);
    return () => window.clearTimeout(timeout);
  }, [acknowledgedRevision, isPending, revision, state.conflict, state.error]);

  const payload: CommercialRevisionInput = {
    ...terms,
    expectedCommercialVersion: currentCommercialVersion,
    lineItems: lineItems.map(withoutKey),
    options: options.map(withoutKey),
    paymentStages: paymentStages.map(withoutKey),
    timelinePhases: timelinePhases.map(withoutKey)
  };

  function updateOption(
    itemKey: string,
    update: Partial<CommercialRevisionInput["options"][number]>
  ) {
    setOptions((items) =>
      items.map((item) => (item.key === itemKey ? { ...item, ...update } : item))
    );
    changed();
  }
  function updateLineItem(
    itemKey: string,
    update: Partial<CommercialRevisionInput["lineItems"][number]>
  ) {
    setLineItems((items) =>
      items.map((item) => (item.key === itemKey ? { ...item, ...update } : item))
    );
    changed();
  }
  function updatePhase(
    itemKey: string,
    update: Partial<CommercialRevisionInput["timelinePhases"][number]>
  ) {
    setTimelinePhases((items) =>
      items.map((item) => (item.key === itemKey ? { ...item, ...update } : item))
    );
    changed();
  }
  function updatePaymentStage(
    itemKey: string,
    update: Partial<CommercialRevisionInput["paymentStages"][number]>
  ) {
    setPaymentStages((items) =>
      items.map((item) => (item.key === itemKey ? { ...item, ...update } : item))
    );
    changed();
  }

  return (
    <form
      action={formAction}
      className={styles.studio}
      data-testid="proposal-commercial-studio"
      onSubmit={() => {
        setAcknowledgedRevision(currentRevisionRef.current);
      }}
      ref={formRef}
    >
      <input name="commercialPayload" type="hidden" value={JSON.stringify(payload)} />
      <header className={styles.header}>
        <div>
          <p>COMMERCIAL / SERVER_CALCULATED</p>
          <h2>Datos comerciales de esta revisión.</h2>
        </div>
        <div className={styles.actions}>
          <span className={styles.status} data-status={status} role="status">
            {status}
          </span>
          <button
            className={styles.button}
            disabled={isPending || Boolean(state.conflict)}
            type="submit"
          >
            Guardar ahora
          </button>
        </div>
      </header>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.fieldErrors?.length ? (
        <div className={styles.error} role="alert">
          <ul>
            {state.fieldErrors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.conflict ? (
        <div className={styles.error} role="alert">
          {state.conflict.message} Versión actual:{" "}
          {state.conflict.currentCommercialVersion}.
          <button
            className={styles.button}
            onClick={() => window.location.reload()}
            type="button"
          >
            Recargar datos
          </button>
        </div>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>CONDITIONS</p>
            <h3>Vigencia y moneda</h3>
          </div>
        </div>
        <div className={styles.fields} data-columns="two">
          <label>
            Moneda ISO{" "}
            <input
              maxLength={3}
              onChange={(event) => {
                setTerms({ ...terms, currency: event.target.value.toUpperCase() });
                changed();
              }}
              value={terms.currency}
            />
          </label>
          <label>
            Vigente hasta{" "}
            <input
              onChange={(event) => {
                setTerms({ ...terms, validUntil: event.target.value || null });
                changed();
              }}
              type="date"
              value={terms.validUntil ?? ""}
            />
          </label>
          <label>
            Impuestos{" "}
            <select
              onChange={(event) => {
                setTerms({
                  ...terms,
                  taxDisplayMode: event.target.value as "EXCLUSIVE" | "INCLUSIVE"
                });
                changed();
              }}
              value={terms.taxDisplayMode}
            >
              <option value="EXCLUSIVE">EXCLUSIVE</option>
              <option value="INCLUSIVE">INCLUSIVE</option>
            </select>
          </label>
          <label>
            Condiciones de pago{" "}
            <input
              onChange={(event) => {
                setTerms({ ...terms, paymentTermsSummary: event.target.value || null });
                changed();
              }}
              value={terms.paymentTermsSummary ?? ""}
            />
          </label>
          <label>
            Entrega{" "}
            <textarea
              onChange={(event) => {
                setTerms({ ...terms, deliveryTerms: event.target.value || null });
                changed();
              }}
              value={terms.deliveryTerms ?? ""}
            />
          </label>
          <label>
            Garantía{" "}
            <textarea
              onChange={(event) => {
                setTerms({ ...terms, warrantySummary: event.target.value || null });
                changed();
              }}
              value={terms.warrantySummary ?? ""}
            />
          </label>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>ALTERNATIVES</p>
            <h3>Alternativas comerciales</h3>
          </div>
          <button
            className={styles.button}
            onClick={() => {
              setOptions((items) => [...items, addOption()]);
              changed();
            }}
            type="button"
          >
            Añadir alternativa
          </button>
        </div>
        <div className={styles.entities}>
          {options.map((option, index) => (
            <fieldset
              className={styles.entity}
              data-active={option.isActive}
              key={option.key}
            >
              <legend>{`ALTERNATIVA ${index + 1}`}</legend>
              <div className={styles.entityHeader}>
                <h4>{option.title}</h4>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setOptions((items) => move(items, index, -1));
                      changed();
                    }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setOptions((items) => move(items, index, 1));
                      changed();
                    }}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setOptions((items) => [
                        ...items,
                        draft("option", {
                          ...withoutKey(option),
                          id: undefined,
                          code: `${option.code}-COPY`,
                          title: `${option.title} copia`
                        })
                      ]);
                      changed();
                    }}
                    type="button"
                  >
                    Duplicar
                  </button>
                </div>
              </div>
              <div className={styles.fields}>
                <label>
                  Código{" "}
                  <input
                    onChange={(event) =>
                      updateOption(option.key, { code: event.target.value.toUpperCase() })
                    }
                    value={option.code}
                  />
                </label>
                <label>
                  Título{" "}
                  <input
                    onChange={(event) =>
                      updateOption(option.key, { title: event.target.value })
                    }
                    value={option.title}
                  />
                </label>
                <label>
                  Duración estimada{" "}
                  <input
                    onChange={(event) =>
                      updateOption(option.key, {
                        estimatedDuration: event.target.value || null
                      })
                    }
                    value={option.estimatedDuration ?? ""}
                  />
                </label>
                <label>
                  Soporte{" "}
                  <input
                    onChange={(event) =>
                      updateOption(option.key, {
                        supportSummary: event.target.value || null
                      })
                    }
                    value={option.supportSummary ?? ""}
                  />
                </label>
              </div>
              <label>
                Descripción{" "}
                <textarea
                  onChange={(event) =>
                    updateOption(option.key, { description: event.target.value || null })
                  }
                  value={option.description ?? ""}
                />
              </label>
              <div className={styles.checks}>
                <label>
                  <input
                    checked={option.isActive}
                    onChange={(event) =>
                      updateOption(option.key, { isActive: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Activa
                </label>
                <label>
                  <input
                    checked={option.recommended}
                    onChange={(event) =>
                      updateOption(option.key, { recommended: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Recomendada
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>LINE_ITEMS</p>
            <h3>Conceptos y rentabilidad</h3>
          </div>
          <button
            className={styles.button}
            onClick={() => {
              setLineItems((items) => [...items, addLineItem()]);
              changed();
            }}
            type="button"
          >
            Añadir concepto
          </button>
        </div>
        <div className={styles.entities}>
          {lineItems.map((lineItem, index) => (
            <fieldset
              className={styles.entity}
              data-active={lineItem.isActive}
              key={lineItem.key}
            >
              <legend>{`CONCEPTO ${index + 1}`}</legend>
              <div className={styles.entityHeader}>
                <h4>{lineItem.name}</h4>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setLineItems((items) => move(items, index, -1));
                      changed();
                    }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setLineItems((items) => move(items, index, 1));
                      changed();
                    }}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setLineItems((items) => [
                        ...items,
                        draft("line", {
                          ...withoutKey(lineItem),
                          id: undefined,
                          code: `${lineItem.code}-COPY`,
                          name: `${lineItem.name} copia`
                        })
                      ]);
                      changed();
                    }}
                    type="button"
                  >
                    Duplicar
                  </button>
                </div>
              </div>
              <div className={styles.clientVisible}>
                <p>CLIENT_VISIBLE</p>
                <div className={styles.fields}>
                  <label>
                    Código{" "}
                    <input
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          code: event.target.value.toUpperCase()
                        })
                      }
                      value={lineItem.code}
                    />
                  </label>
                  <label>
                    Nombre{" "}
                    <input
                      onChange={(event) =>
                        updateLineItem(lineItem.key, { name: event.target.value })
                      }
                      value={lineItem.name}
                    />
                  </label>
                  <label>
                    Alternativa{" "}
                    <select
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          optionCode: event.target.value || null,
                          scope: event.target.value ? "OPTION_SPECIFIC" : "COMMON"
                        })
                      }
                      value={lineItem.optionCode ?? ""}
                    >
                      <option value="">COMÚN</option>
                      {optionCodes.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Tipo{" "}
                    <select
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          billingType: event.target
                            .value as CommercialRevisionInput["lineItems"][number]["billingType"]
                        })
                      }
                      value={lineItem.billingType}
                    >
                      <option value="ONE_TIME">ONE_TIME</option>
                      <option value="MONTHLY">MONTHLY</option>
                      <option value="ANNUAL">ANNUAL</option>
                      <option value="HOURLY">HOURLY</option>
                      <option value="PER_USER">PER_USER</option>
                      <option value="PER_DEVICE">PER_DEVICE</option>
                      <option value="PER_LOCATION">PER_LOCATION</option>
                      <option value="PER_SITE">PER_SITE</option>
                      <option value="INCLUDED">INCLUDED</option>
                      <option value="OPTIONAL">OPTIONAL</option>
                    </select>
                  </label>
                  <label>
                    Cantidad{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, { quantity: event.target.value })
                      }
                      value={lineItem.quantity}
                    />
                  </label>
                  <label>
                    Unidad{" "}
                    <input
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          unit: event.target.value.toLowerCase()
                        })
                      }
                      value={lineItem.unit}
                    />
                  </label>
                  <label>
                    Precio final{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, { unitPrice: event.target.value })
                      }
                      value={lineItem.unitPrice}
                    />
                  </label>
                  <label>
                    Descuento{" "}
                    <select
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          discountType: event.target.value as
                            "NONE" | "PERCENTAGE" | "FIXED_AMOUNT"
                        })
                      }
                      value={lineItem.discountType}
                    >
                      <option value="NONE">NONE</option>
                      <option value="PERCENTAGE">PERCENTAGE</option>
                      <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                    </select>
                  </label>
                  <label>
                    Valor descuento{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          discountValue: event.target.value
                        })
                      }
                      value={lineItem.discountValue}
                    />
                  </label>
                  <label>
                    Impuesto %{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, { taxRate: event.target.value })
                      }
                      value={lineItem.taxRate}
                    />
                  </label>
                </div>
                <label>
                  Descripción{" "}
                  <textarea
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        description: event.target.value || null
                      })
                    }
                    value={lineItem.description ?? ""}
                  />
                </label>
              </div>
              <div className={styles.internal}>
                <p>INTERNAL_ONLY</p>
                <div className={styles.fields}>
                  <label>
                    Costo interno{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          internalCost: event.target.value || null
                        })
                      }
                      value={lineItem.internalCost ?? ""}
                    />
                  </label>
                  <label>
                    Modo{" "}
                    <select
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          pricingMode: event.target.value as "MANUAL" | "MARKUP"
                        })
                      }
                      value={lineItem.pricingMode}
                    >
                      <option value="MANUAL">MANUAL</option>
                      <option value="MARKUP">MARKUP</option>
                    </select>
                  </label>
                  <label>
                    Markup %{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          markupPercent: event.target.value || null
                        })
                      }
                      value={lineItem.markupPercent ?? ""}
                    />
                  </label>
                  <label>
                    Contingencia %{" "}
                    <input
                      inputMode="decimal"
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          contingencyPercent: event.target.value || null
                        })
                      }
                      value={lineItem.contingencyPercent ?? ""}
                    />
                  </label>
                  <label>
                    Proveedor{" "}
                    <input
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          supplier: event.target.value || null
                        })
                      }
                      value={lineItem.supplier ?? ""}
                    />
                  </label>
                  <label>
                    Referencia proveedor{" "}
                    <input
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          supplierReference: event.target.value || null
                        })
                      }
                      value={lineItem.supplierReference ?? ""}
                    />
                  </label>
                </div>
                <label>
                  Notas internas{" "}
                  <textarea
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        internalNotes: event.target.value || null
                      })
                    }
                    value={lineItem.internalNotes ?? ""}
                  />
                </label>
              </div>
              <div className={styles.checks}>
                <label>
                  <input
                    checked={lineItem.isActive}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { isActive: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Activo
                </label>
                <label>
                  <input
                    checked={lineItem.visibleToClient}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        visibleToClient: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  Visible al cliente
                </label>
                <label>
                  <input
                    checked={lineItem.isTaxable}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { isTaxable: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Gravable
                </label>
                <label>
                  <input
                    checked={lineItem.taxIncluded}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { taxIncluded: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Impuesto incluido
                </label>
                <label>
                  <input
                    checked={lineItem.isOptional}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { isOptional: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Opcional
                </label>
                <label>
                  <input
                    checked={lineItem.selectedByDefault}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        selectedByDefault: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  Opcional por defecto
                </label>
                <label>
                  <input
                    checked={lineItem.isIncluded}
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { isIncluded: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Incluido
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>TIMELINE</p>
            <h3>Cronograma propuesto</h3>
          </div>
          <button
            className={styles.button}
            onClick={() => {
              setTimelinePhases((items) => [...items, addPhase()]);
              changed();
            }}
            type="button"
          >
            Añadir fase
          </button>
        </div>
        <div className={styles.entities}>
          {timelinePhases.map((phase, index) => (
            <fieldset className={styles.entity} key={phase.key}>
              <legend>{`FASE ${index + 1}`}</legend>
              <div className={styles.entityHeader}>
                <h4>{phase.title}</h4>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setTimelinePhases((items) => move(items, index, -1));
                      changed();
                    }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setTimelinePhases((items) =>
                        items.filter((item) => item.key !== phase.key)
                      );
                      changed();
                    }}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <div className={styles.fields}>
                <label>
                  Código{" "}
                  <input
                    onChange={(event) =>
                      updatePhase(phase.key, { code: event.target.value.toUpperCase() })
                    }
                    value={phase.code}
                  />
                </label>
                <label>
                  Título{" "}
                  <input
                    onChange={(event) =>
                      updatePhase(phase.key, { title: event.target.value })
                    }
                    value={phase.title}
                  />
                </label>
                <label>
                  Duración{" "}
                  <input
                    min="1"
                    onChange={(event) =>
                      updatePhase(phase.key, {
                        durationValue: Number.parseInt(event.target.value || "1", 10) || 1
                      })
                    }
                    type="number"
                    value={phase.durationValue}
                  />
                </label>
                <label>
                  Unidad{" "}
                  <select
                    onChange={(event) =>
                      updatePhase(phase.key, {
                        durationUnit: event.target.value as "DAY" | "WEEK" | "MONTH"
                      })
                    }
                    value={phase.durationUnit}
                  >
                    <option value="DAY">DAY</option>
                    <option value="WEEK">WEEK</option>
                    <option value="MONTH">MONTH</option>
                  </select>
                </label>
                <label>
                  Alternativa{" "}
                  <select
                    onChange={(event) =>
                      updatePhase(phase.key, { optionCode: event.target.value || null })
                    }
                    value={phase.optionCode ?? ""}
                  >
                    <option value="">COMÚN</option>
                    {optionCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Depende de{" "}
                  <input
                    onChange={(event) =>
                      updatePhase(phase.key, {
                        dependsOnCodes: event.target.value
                          .split(",")
                          .map((item) => item.trim().toUpperCase())
                          .filter(Boolean)
                      })
                    }
                    value={phase.dependsOnCodes.join(", ")}
                  />
                </label>
              </div>
              <label>
                Descripción{" "}
                <textarea
                  onChange={(event) =>
                    updatePhase(phase.key, { description: event.target.value || null })
                  }
                  value={phase.description ?? ""}
                />
              </label>
              <label>
                Entregables (uno por linea){" "}
                <textarea
                  onChange={(event) =>
                    updatePhase(phase.key, {
                      deliverables: event.target.value
                        .split("\n")
                        .map((title) => title.trim())
                        .filter(Boolean)
                        .map((title) => ({
                          description: null,
                          title,
                          visibleToClient: true
                        }))
                    })
                  }
                  value={phase.deliverables
                    .map((deliverable) => deliverable.title)
                    .join("\n")}
                />
              </label>
              <div className={styles.checks}>
                <label>
                  <input
                    checked={phase.isOptional}
                    onChange={(event) =>
                      updatePhase(phase.key, { isOptional: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Fase opcional
                </label>
                <label>
                  <input
                    checked={phase.visibleToClient}
                    onChange={(event) =>
                      updatePhase(phase.key, { visibleToClient: event.target.checked })
                    }
                    type="checkbox"
                  />
                  Visible al cliente
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p>PAYMENT_SCHEDULE</p>
            <h3>Etapas comerciales</h3>
          </div>
          <button
            className={styles.button}
            onClick={() => {
              setPaymentStages((items) => [...items, addPaymentStage()]);
              changed();
            }}
            type="button"
          >
            Añadir etapa
          </button>
        </div>
        <div className={styles.entities}>
          {paymentStages.map((stage, index) => (
            <fieldset className={styles.entity} key={stage.key}>
              <legend>{`ETAPA ${index + 1}`}</legend>
              <div className={styles.entityHeader}>
                <h4>{stage.title}</h4>
                <div className={styles.actions}>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setPaymentStages((items) => move(items, index, -1));
                      changed();
                    }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    className={styles.button}
                    onClick={() => {
                      setPaymentStages((items) =>
                        items.filter((item) => item.key !== stage.key)
                      );
                      changed();
                    }}
                    type="button"
                  >
                    Quitar
                  </button>
                </div>
              </div>
              <div className={styles.fields}>
                <label>
                  Título{" "}
                  <input
                    onChange={(event) =>
                      updatePaymentStage(stage.key, { title: event.target.value })
                    }
                    value={stage.title}
                  />
                </label>
                <label>
                  Tipo{" "}
                  <select
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        calculationType: event.target.value as
                          "PERCENTAGE" | "FIXED_AMOUNT" | "REMAINDER"
                      })
                    }
                    value={stage.calculationType}
                  >
                    <option value="PERCENTAGE">PERCENTAGE</option>
                    <option value="FIXED_AMOUNT">FIXED_AMOUNT</option>
                    <option value="REMAINDER">REMAINDER</option>
                  </select>
                </label>
                <label>
                  Alternativa{" "}
                  <select
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        optionCode: event.target.value || null
                      })
                    }
                    value={stage.optionCode ?? ""}
                  >
                    <option value="">COMUN</option>
                    {optionCodes.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Porcentaje{" "}
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        percentage: event.target.value || null
                      })
                    }
                    value={stage.percentage ?? ""}
                  />
                </label>
                <label>
                  Importe fijo{" "}
                  <input
                    inputMode="decimal"
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        fixedAmount: event.target.value || null
                      })
                    }
                    value={stage.fixedAmount ?? ""}
                  />
                </label>
                <label>
                  Disparador{" "}
                  <select
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        triggerType: event.target
                          .value as CommercialRevisionInput["paymentStages"][number]["triggerType"]
                      })
                    }
                    value={stage.triggerType}
                  >
                    <option value="ACCEPTANCE">ACCEPTANCE</option>
                    <option value="PROJECT_START">PROJECT_START</option>
                    <option value="MILESTONE">MILESTONE</option>
                    <option value="DELIVERY">DELIVERY</option>
                    <option value="CALENDAR_DATE">CALENDAR_DATE</option>
                    <option value="MANUAL">MANUAL</option>
                  </select>
                </label>
                <label>
                  Plazo días{" "}
                  <input
                    min="0"
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        dueDays: event.target.value
                          ? Number.parseInt(event.target.value, 10)
                          : null
                      })
                    }
                    type="number"
                    value={stage.dueDays ?? ""}
                  />
                </label>
              </div>
              <label>
                Observación{" "}
                <textarea
                  onChange={(event) =>
                    updatePaymentStage(stage.key, {
                      triggerDescription: event.target.value || null
                    })
                  }
                  value={stage.triggerDescription ?? ""}
                />
              </label>
              <label>
                Descripcion{" "}
                <textarea
                  onChange={(event) =>
                    updatePaymentStage(stage.key, {
                      description: event.target.value || null
                    })
                  }
                  value={stage.description ?? ""}
                />
              </label>
              <div className={styles.checks}>
                <label>
                  <input
                    checked={stage.visibleToClient}
                    onChange={(event) =>
                      updatePaymentStage(stage.key, {
                        visibleToClient: event.target.checked
                      })
                    }
                    type="checkbox"
                  />
                  Visible al cliente
                </label>
              </div>
            </fieldset>
          ))}
        </div>
      </section>
    </form>
  );
}
