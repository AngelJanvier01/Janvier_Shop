"use client";

import { useActionState } from "react";

import {
  createProjectFromAcceptedProposal,
  type CreateProjectFromProposalState
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./proposal-project-create.module.css";

const initialState: CreateProjectFromProposalState = {};

export function ProposalProjectCreate({ proposalId }: { proposalId: string }) {
  const action = createProjectFromAcceptedProposal.bind(null, proposalId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <p>POST_ACCEPTANCE / PROJECT_HANDOFF</p>
      <h2>La decisión ya puede convertirse en trabajo operativo.</h2>
      <span>
        Se creará un proyecto privado en borrador, vinculado a esta propuesta y a su
        cliente. La propuesta aceptada no se modifica.
      </span>
      <button disabled={isPending} type="submit">
        {isPending ? "Creando proyecto..." : "Crear proyecto desde aceptación"}
      </button>
      {state.error ? <small className={styles.error}>{state.error}</small> : null}
      {state.success ? <small className={styles.success}>{state.success}</small> : null}
    </form>
  );
}
