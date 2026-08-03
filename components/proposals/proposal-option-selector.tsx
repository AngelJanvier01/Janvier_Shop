"use client";

import { useActionState } from "react";

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
  const action = selectProposalOption.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.optionSelector}>
      <p>ALTERNATIVA ELEGIDA</p>
      <div className={styles.optionChoices} role="radiogroup" aria-label="Alternativas">
        {options.map((option, index) => (
          <label key={option.id}>
            <input
              defaultChecked={selectedOptionId === option.id}
              name="optionId"
              required={index === 0}
              type="radio"
              value={option.id}
            />
            <span>{option.title}</span>
          </label>
        ))}
      </div>
      <button className={styles.primary} disabled={isPending} type="submit">
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
