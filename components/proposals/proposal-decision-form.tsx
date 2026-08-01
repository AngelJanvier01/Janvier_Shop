"use client";

import { useActionState, useState } from "react";

import { submitProposalDecision } from "@/app/propuesta/[token]/actions";

import styles from "./proposal-interaction.module.css";

type ProposalDecisionFormProps = {
  email: string;
  name: string;
  token: string;
};

export function ProposalDecisionForm({ email, name, token }: ProposalDecisionFormProps) {
  const [decision, setDecision] = useState<"ACCEPT" | "REQUEST_CHANGES" | "DECLINE">(
    "ACCEPT"
  );
  const action = submitProposalDecision.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className={styles.form}
      data-testid="proposal-decision-form"
    >
      <input name="decision" type="hidden" value={decision} />
      <div className={styles.choiceRow} aria-label="Decision sobre la propuesta">
        <button
          aria-pressed={decision === "ACCEPT"}
          className={decision === "ACCEPT" ? styles.choiceActive : styles.choice}
          onClick={() => setDecision("ACCEPT")}
          type="button"
        >
          Aceptar propuesta
        </button>
        <button
          aria-pressed={decision === "REQUEST_CHANGES"}
          className={decision === "REQUEST_CHANGES" ? styles.choiceActive : styles.choice}
          onClick={() => setDecision("REQUEST_CHANGES")}
          type="button"
        >
          Solicitar ajustes
        </button>
        <button
          aria-pressed={decision === "DECLINE"}
          className={decision === "DECLINE" ? styles.choiceActive : styles.choice}
          onClick={() => setDecision("DECLINE")}
          type="button"
        >
          No continuar
        </button>
      </div>
      <div className={styles.identity}>
        <label>
          <span>NOMBRE</span>
          <input defaultValue={name} name="authorName" required type="text" />
        </label>
        <label>
          <span>CORREO</span>
          <input defaultValue={email} name="authorEmail" required type="email" />
        </label>
      </div>
      <label>
        <span>
          {decision === "REQUEST_CHANGES"
            ? "AJUSTES NECESARIOS / REQUIRED"
            : "NOTA OPCIONAL"}
        </span>
        <textarea
          name="note"
          placeholder={
            decision === "REQUEST_CHANGES"
              ? "Cuéntanos exactamente que quieres cambiar."
              : "Puedes añadir contexto para el equipo."
          }
          required={decision === "REQUEST_CHANGES"}
          rows={4}
        />
      </label>
      {decision === "ACCEPT" ? (
        <label className={styles.check}>
          <input name="termsAccepted" required type="checkbox" />
          <span>Confirmo que acepto los terminos y alcance de esta propuesta.</span>
        </label>
      ) : null}
      <button className={styles.primary} disabled={isPending} type="submit">
        {isPending ? "Registrando..." : "Confirmar decision"}
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
