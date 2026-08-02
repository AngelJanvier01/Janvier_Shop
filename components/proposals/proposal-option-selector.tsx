"use client";

import { useActionState, useState } from "react";

import { selectProposalOption } from "@/app/propuesta/[token]/actions";

import styles from "./proposal-interaction.module.css";

type ProposalOptionSelectorProps = {
  options: Array<{ id: string; title: string }>;
  selectedOptionId: string | null;
  token: string;
};

export function ProposalOptionSelector({
  options,
  selectedOptionId,
  token
}: ProposalOptionSelectorProps) {
  const [selected, setSelected] = useState(selectedOptionId ?? "");
  const action = selectProposalOption.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.optionSelector}>
      <input name="optionId" type="hidden" value={selected} />
      <p>ALTERNATIVA ELEGIDA</p>
      <div className={styles.optionChoices} role="radiogroup" aria-label="Alternativas">
        {options.map((option) => (
          <label key={option.id}>
            <input
              checked={selected === option.id}
              name="option-choice"
              onChange={() => setSelected(option.id)}
              type="radio"
              value={option.id}
            />
            <span>{option.title}</span>
          </label>
        ))}
      </div>
      <button className={styles.primary} disabled={isPending || !selected} type="submit">
        {isPending ? "Guardando..." : "Guardar alternativa"}
      </button>
      {state.error ? (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      ) : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
    </form>
  );
}
