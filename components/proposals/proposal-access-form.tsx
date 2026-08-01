"use client";

import { useActionState } from "react";

import {
  type ProposalAccessState,
  unlockProposalInvite
} from "@/app/propuesta/[token]/actions";

import styles from "./proposal-access-form.module.css";

type ProposalAccessFormProps = {
  token: string;
};

const initialState: ProposalAccessState = {};

export function ProposalAccessForm({ token }: ProposalAccessFormProps) {
  const action = unlockProposalInvite.bind(null, token);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <label htmlFor="proposal-access-code">CODIGO DE ACCESO</label>
      <input
        autoComplete="one-time-code"
        id="proposal-access-code"
        inputMode="text"
        maxLength={9}
        name="accessCode"
        placeholder="ABCD-EFGH"
        required
        spellCheck={false}
      />
      <button disabled={isPending} type="submit">
        {isPending ? "Verificando..." : "Abrir propuesta"}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
