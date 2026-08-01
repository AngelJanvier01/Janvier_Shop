"use client";

import { useActionState } from "react";

import {
  type ProposalRevisionState,
  updateEditableProposalRevision
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./proposal-revision-editor.module.css";

type ProposalRevisionEditorProps = {
  introduction: string | null;
  investment: string | null;
  revisionId: string;
  terms: string | null;
  title: string;
};

const initialState: ProposalRevisionState = {};

export function ProposalRevisionEditor({
  introduction,
  investment,
  revisionId,
  terms,
  title
}: ProposalRevisionEditorProps) {
  const action = updateEditableProposalRevision.bind(null, revisionId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <p>DRAFT_REVISION / EDITABLE</p>
        <h2>Haz los ajustes antes de volver a compartir.</h2>
      </div>
      <label>
        <span>TITULO</span>
        <input defaultValue={title} name="title" required type="text" />
      </label>
      <label>
        <span>INVERSION TOTAL</span>
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
      <label className={styles.full}>
        <span>TERMINOS</span>
        <textarea defaultValue={terms ?? ""} name="terms" rows={5} />
      </label>
      <button disabled={isPending} type="submit">
        {isPending ? "Guardando..." : "Guardar revision"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.success ? <p className={styles.success}>{state.success}</p> : null}
    </form>
  );
}
