"use client";

import { useActionState, useState } from "react";

import {
  type ProposalRevisionState,
  updateEditableProposalRevision
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./proposal-revision-editor.module.css";

const sectionTypes = [
  ["CONTEXT", "Contexto"],
  ["SCOPE", "Alcance"],
  ["DELIVERABLES", "Entregables"],
  ["TIMELINE", "Fases y calendario"],
  ["INVESTMENT", "Inversión"],
  ["TERMS", "Condiciones"],
  ["REFERENCE", "Referencia"],
  ["CUSTOM", "Bloque personalizado"]
] as const;

const lineItemTypes = [
  ["ONE_TIME", "Pago único"],
  ["MONTHLY", "Mensual"],
  ["ANNUAL", "Anual"],
  ["INCLUDED", "Incluido"],
  ["OPTIONAL", "Opcional"]
] as const;

type SectionType = (typeof sectionTypes)[number][0];
type LineItemType = (typeof lineItemTypes)[number][0];

type ProposalSectionDraft = {
  content: string | null;
  isIncluded: boolean;
  key: string;
  title: string;
  type: SectionType;
};

type ProposalOptionDraft = {
  code: string;
  description: string | null;
  investment: string | null;
  isEnabled: boolean;
  key: string;
  recommended: boolean;
  taxIncluded: boolean;
  title: string;
};

type ProposalLineItemDraft = {
  code: string;
  description: string;
  discount: string;
  internalCost: string | null;
  internalNotes: string | null;
  key: string;
  markupPercent: string | null;
  optionCode: string | null;
  quantity: string;
  taxRate: string;
  type: LineItemType;
  unitPrice: string;
  visibleForClient: boolean;
};

type ProposalRevisionEditorProps = {
  introduction: string | null;
  investment: string | null;
  lineItems: Array<{
    code: string;
    description: string;
    discount: string;
    internalCost: string | null;
    internalNotes: string | null;
    markupPercent: string | null;
    optionCode: string | null;
    quantity: string;
    taxRate: string;
    type: LineItemType;
    unitPrice: string;
    visibleForClient: boolean;
  }>;
  options: Array<{
    code: string;
    description: string | null;
    investment: string | null;
    isEnabled: boolean;
    recommended: boolean;
    taxIncluded: boolean;
    title: string;
  }>;
  revisionId: string;
  sections: Array<{
    content: string | null;
    isIncluded: boolean;
    title: string;
    type: SectionType;
  }>;
  taxIncluded: boolean;
  terms: string | null;
  title: string;
};

const initialState: ProposalRevisionState = {};

function newKey(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function ProposalRevisionEditor({
  introduction,
  investment,
  lineItems: initialLineItems,
  options: initialOptions,
  revisionId,
  sections: initialSections,
  taxIncluded,
  terms,
  title
}: ProposalRevisionEditorProps) {
  const action = updateEditableProposalRevision.bind(null, revisionId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [sections, setSections] = useState<ProposalSectionDraft[]>(() =>
    initialSections.length
      ? initialSections.map((section, index) => ({ ...section, key: `section-${index}` }))
      : [
          {
            content: "",
            isIncluded: true,
            key: "section-context",
            title: "Contexto y objetivo",
            type: "CONTEXT"
          }
        ]
  );
  const [options, setOptions] = useState<ProposalOptionDraft[]>(() =>
    initialOptions.map((option, index) => ({ ...option, key: `option-${index}` }))
  );
  const [lineItems, setLineItems] = useState<ProposalLineItemDraft[]>(() =>
    initialLineItems.map((lineItem, index) => ({
      ...lineItem,
      key: `line-item-${index}`
    }))
  );

  function updateSection(
    key: string,
    update: Partial<Omit<ProposalSectionDraft, "key">>
  ) {
    setSections((current) =>
      current.map((section) =>
        section.key === key ? { ...section, ...update } : section
      )
    );
  }

  function updateOption(key: string, update: Partial<Omit<ProposalOptionDraft, "key">>) {
    setOptions((current) =>
      current.map((option) => (option.key === key ? { ...option, ...update } : option))
    );
  }

  function updateLineItem(
    key: string,
    update: Partial<Omit<ProposalLineItemDraft, "key">>
  ) {
    setLineItems((current) =>
      current.map((lineItem) =>
        lineItem.key === key ? { ...lineItem, ...update } : lineItem
      )
    );
  }

  return (
    <form action={formAction} className={styles.form}>
      <input
        name="sections"
        type="hidden"
        value={JSON.stringify(
          sections.map(({ content, isIncluded, title: sectionTitle, type }) => ({
            content,
            isIncluded,
            title: sectionTitle,
            type
          }))
        )}
      />
      <input
        name="options"
        type="hidden"
        value={JSON.stringify(
          options.map(
            ({
              code,
              description,
              investment: optionInvestment,
              recommended,
              taxIncluded: optionTaxIncluded,
              title: optionTitle
            }) => ({
              code,
              description,
              investment: optionInvestment,
              recommended,
              taxIncluded: optionTaxIncluded,
              title: optionTitle
            })
          )
        )}
      />
      <input
        name="lineItems"
        type="hidden"
        value={JSON.stringify(
          lineItems.map(({ key: _key, ...lineItem }) => {
            void _key;
            return lineItem;
          })
        )}
      />

      <div className={styles.intro}>
        <p>DRAFT_REVISION / EDITABLE</p>
        <h2>Construye una propuesta que se pueda entender y decidir.</h2>
        <span>
          Los bloques y alternativas se guardan juntos en esta revisión. Al compartirla,
          quedará bloqueada como evidencia de lo que vio el cliente.
        </span>
      </div>

      <div className={styles.coreFields}>
        <label>
          <span>TÍTULO</span>
          <input defaultValue={title} name="title" required type="text" />
        </label>
        <label>
          <span>INVERSIÓN TOTAL</span>
          <input
            defaultValue={investment ?? ""}
            inputMode="decimal"
            min="0"
            name="investment"
            placeholder="Ej. 35000"
            type="number"
          />
        </label>
        <label className={styles.full}>
          <span>CONTEXTO Y OBJETIVO</span>
          <textarea defaultValue={introduction ?? ""} name="introduction" rows={5} />
        </label>
      </div>

      <section className={styles.builder} aria-labelledby="proposal-blocks-title">
        <div className={styles.builderHeader}>
          <div>
            <p>01 / BLOQUES DE LA PROPUESTA</p>
            <h3 id="proposal-blocks-title">Alcance, entregables y ruta de trabajo.</h3>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={sections.length >= 12 || isPending}
            onClick={() =>
              setSections((current) => [
                ...current,
                {
                  content: "",
                  isIncluded: true,
                  key: newKey("section"),
                  title: "Nuevo bloque",
                  type: "CUSTOM"
                }
              ])
            }
            type="button"
          >
            + Añadir bloque
          </button>
        </div>
        <div className={styles.cards}>
          {sections.map((section, index) => (
            <fieldset className={styles.card} key={section.key}>
              <legend>BLOQUE / {String(index + 1).padStart(2, "0")}</legend>
              <div className={styles.cardActions}>
                <label className={styles.toggle}>
                  <input
                    checked={section.isIncluded}
                    onChange={(event) =>
                      updateSection(section.key, { isIncluded: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Incluir para cliente</span>
                </label>
                <button
                  className={styles.removeButton}
                  disabled={sections.length === 1 || isPending}
                  onClick={() =>
                    setSections((current) =>
                      current.filter((item) => item.key !== section.key)
                    )
                  }
                  type="button"
                >
                  Eliminar
                </button>
              </div>
              <label>
                <span>TIPO</span>
                <select
                  onChange={(event) =>
                    updateSection(section.key, {
                      type: event.target.value as SectionType
                    })
                  }
                  value={section.type}
                >
                  {sectionTypes.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>TÍTULO DEL BLOQUE</span>
                <input
                  onChange={(event) =>
                    updateSection(section.key, { title: event.target.value })
                  }
                  required
                  type="text"
                  value={section.title}
                />
              </label>
              <label className={styles.cardFull}>
                <span>CONTENIDO</span>
                <textarea
                  onChange={(event) =>
                    updateSection(section.key, { content: event.target.value })
                  }
                  placeholder="Escribe lo que el cliente necesita comprender. Conserva los saltos de línea si ayudan a leer."
                  rows={5}
                  value={section.content ?? ""}
                />
              </label>
            </fieldset>
          ))}
        </div>
      </section>

      <section className={styles.builder} aria-labelledby="proposal-options-title">
        <div className={styles.builderHeader}>
          <div>
            <p>02 / ALTERNATIVAS</p>
            <h3 id="proposal-options-title">
              Permite comparar opciones sin convertirlo en un checkout.
            </h3>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={options.length >= 8 || isPending}
            onClick={() =>
              setOptions((current) => [
                ...current,
                {
                  code: `OPC-${current.length + 1}`,
                  description: "",
                  investment: "",
                  key: newKey("option"),
                  recommended: current.length === 0,
                  isEnabled: true,
                  taxIncluded: false,
                  title: "Nueva alternativa"
                }
              ])
            }
            type="button"
          >
            + Añadir alternativa
          </button>
        </div>
        {options.length ? (
          <div className={styles.cards}>
            {options.map((option, index) => (
              <fieldset className={styles.card} key={option.key}>
                <legend>ALTERNATIVA / {String(index + 1).padStart(2, "0")}</legend>
                <div className={styles.cardActions}>
                  <label className={styles.toggle}>
                    <input
                      checked={option.recommended}
                      onChange={(event) =>
                        updateOption(option.key, { recommended: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span>Recomendada</span>
                  </label>
                  <label className={styles.toggle}>
                    <input
                      checked={option.isEnabled}
                      onChange={(event) =>
                        updateOption(option.key, { isEnabled: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span>Disponible para seleccionar</span>
                  </label>
                  <button
                    className={styles.removeButton}
                    disabled={isPending}
                    onClick={() =>
                      setOptions((current) =>
                        current.filter((item) => item.key !== option.key)
                      )
                    }
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
                <label>
                  <span>CÓDIGO</span>
                  <input
                    onChange={(event) =>
                      updateOption(option.key, { code: event.target.value })
                    }
                    required
                    type="text"
                    value={option.code}
                  />
                </label>
                <label>
                  <span>NOMBRE</span>
                  <input
                    onChange={(event) =>
                      updateOption(option.key, { title: event.target.value })
                    }
                    required
                    type="text"
                    value={option.title}
                  />
                </label>
                <label>
                  <span>INVERSIÓN</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateOption(option.key, { investment: event.target.value })
                    }
                    placeholder="A definir"
                    type="number"
                    value={option.investment ?? ""}
                  />
                </label>
                <label className={styles.toggle}>
                  <input
                    checked={option.taxIncluded}
                    onChange={(event) =>
                      updateOption(option.key, { taxIncluded: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>Impuestos incluidos</span>
                </label>
                <label className={styles.cardFull}>
                  <span>NOTA PARA ESTA ALTERNATIVA</span>
                  <textarea
                    onChange={(event) =>
                      updateOption(option.key, { description: event.target.value })
                    }
                    rows={4}
                    value={option.description ?? ""}
                  />
                </label>
              </fieldset>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            Sin alternativas: se mostrará solamente la inversión total.
          </p>
        )}
      </section>

      <section className={styles.builder} aria-labelledby="proposal-line-items-title">
        <div className={styles.builderHeader}>
          <div>
            <p>03 / CONCEPTOS ECONÓMICOS</p>
            <h3 id="proposal-line-items-title">
              Se calculan en servidor; los costos internos nunca salen al cliente.
            </h3>
          </div>
          <button
            className={styles.secondaryButton}
            disabled={lineItems.length >= 40 || isPending}
            onClick={() =>
              setLineItems((current) => [
                ...current,
                {
                  code: `ITEM-${current.length + 1}`,
                  description: "Nuevo concepto",
                  discount: "0",
                  internalCost: "",
                  internalNotes: "",
                  key: newKey("line-item"),
                  markupPercent: "",
                  optionCode: null,
                  quantity: "1",
                  taxRate: "0",
                  type: "ONE_TIME",
                  unitPrice: "0",
                  visibleForClient: true
                }
              ])
            }
            type="button"
          >
            + Añadir concepto
          </button>
        </div>
        {lineItems.length ? (
          <div className={styles.cards}>
            {lineItems.map((lineItem, index) => (
              <fieldset className={styles.card} key={lineItem.key}>
                <legend>CONCEPTO / {String(index + 1).padStart(2, "0")}</legend>
                <div className={styles.cardActions}>
                  <label className={styles.toggle}>
                    <input
                      checked={lineItem.visibleForClient}
                      onChange={(event) =>
                        updateLineItem(lineItem.key, {
                          visibleForClient: event.target.checked
                        })
                      }
                      type="checkbox"
                    />
                    <span>Visible para cliente</span>
                  </label>
                  <button
                    className={styles.removeButton}
                    disabled={isPending}
                    onClick={() =>
                      setLineItems((current) =>
                        current.filter((item) => item.key !== lineItem.key)
                      )
                    }
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
                <label>
                  <span>CÓDIGO</span>
                  <input
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { code: event.target.value })
                    }
                    required
                    type="text"
                    value={lineItem.code}
                  />
                </label>
                <label>
                  <span>TIPO</span>
                  <select
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        type: event.target.value as LineItemType
                      })
                    }
                    value={lineItem.type}
                  >
                    {lineItemTypes.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>ALTERNATIVA</span>
                  <select
                    onChange={(event) =>
                      updateLineItem(lineItem.key, {
                        optionCode: event.target.value || null
                      })
                    }
                    value={lineItem.optionCode ?? ""}
                  >
                    <option value="">Común a la propuesta</option>
                    {options.map((option) => (
                      <option key={option.code} value={option.code}>
                        {option.code} / {option.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>CANTIDAD</span>
                  <input
                    inputMode="decimal"
                    min="0.001"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { quantity: event.target.value })
                    }
                    required
                    type="number"
                    value={lineItem.quantity}
                  />
                </label>
                <label>
                  <span>PRECIO UNITARIO</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { unitPrice: event.target.value })
                    }
                    required
                    type="number"
                    value={lineItem.unitPrice}
                  />
                </label>
                <label>
                  <span>DESCUENTO</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { discount: event.target.value })
                    }
                    required
                    type="number"
                    value={lineItem.discount}
                  />
                </label>
                <label>
                  <span>IMPUESTO %</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { taxRate: event.target.value })
                    }
                    required
                    type="number"
                    value={lineItem.taxRate}
                  />
                </label>
                <label>
                  <span>COSTO INTERNO</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { internalCost: event.target.value })
                    }
                    type="number"
                    value={lineItem.internalCost ?? ""}
                  />
                </label>
                <label>
                  <span>MARKUP %</span>
                  <input
                    inputMode="decimal"
                    min="0"
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { markupPercent: event.target.value })
                    }
                    type="number"
                    value={lineItem.markupPercent ?? ""}
                  />
                </label>
                <label className={styles.cardFull}>
                  <span>DESCRIPCIÓN PARA CLIENTE</span>
                  <textarea
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { description: event.target.value })
                    }
                    required
                    rows={3}
                    value={lineItem.description}
                  />
                </label>
                <label className={styles.cardFull}>
                  <span>NOTAS INTERNAS</span>
                  <textarea
                    onChange={(event) =>
                      updateLineItem(lineItem.key, { internalNotes: event.target.value })
                    }
                    rows={3}
                    value={lineItem.internalNotes ?? ""}
                  />
                </label>
              </fieldset>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            Sin conceptos: se usa la inversión total o la alternativa elegida.
          </p>
        )}
      </section>

      <label className={styles.terms}>
        <span>04 / CONDICIONES, VIGENCIA Y DEPENDENCIAS</span>
        <textarea defaultValue={terms ?? ""} name="terms" rows={6} />
      </label>
      <label className={styles.toggle}>
        <input
          defaultChecked={taxIncluded}
          name="taxIncluded"
          type="checkbox"
          value="true"
        />
        <span>La inversión total incluye impuestos</span>
      </label>

      <button className={styles.submit} disabled={isPending} type="submit">
        {isPending ? "Guardando..." : "Guardar revisión completa"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
    </form>
  );
}
