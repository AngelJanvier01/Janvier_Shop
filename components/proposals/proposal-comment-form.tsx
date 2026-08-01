"use client";

import { useActionState } from "react";

import { submitProposalComment } from "@/app/propuesta/[token]/actions";

import styles from "./proposal-interaction.module.css";

type ProposalCommentFormProps = {
  email: string;
  name: string;
  token: string;
};

export function ProposalCommentForm({ email, name, token }: ProposalCommentFormProps) {
  const action = submitProposalComment.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, {});

  return (
    <form action={formAction} className={styles.form} data-testid="proposal-comment-form">
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
        <span>NOTA PARA JANVIER</span>
        <textarea
          name="content"
          placeholder="Pregunta, comentario o contexto adicional."
          required
          rows={4}
        />
      </label>
      <button disabled={isPending} type="submit">
        {isPending ? "Enviando..." : "Enviar nota"}
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
