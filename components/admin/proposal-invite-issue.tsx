"use client";

import { useActionState } from "react";

import {
  issueProposalInvite,
  type IssueProposalInviteState
} from "@/app/(admin)/admin/propuestas/actions";

import styles from "./proposal-invite-issue.module.css";

type ProposalInviteIssueProps = {
  proposalId: string;
};

const initialState: IssueProposalInviteState = {};

export function ProposalInviteIssue({ proposalId }: ProposalInviteIssueProps) {
  const action = issueProposalInvite.bind(null, proposalId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <p>INVITE / ROTATE_SECURE_TOKEN</p>
        <h2>Emite una nueva sala privada.</h2>
        <span>La invitacion anterior deja de funcionar al crear esta nueva.</span>
      </div>
      <button disabled={isPending} type="submit">
        {isPending ? "Generando..." : "Generar enlace y codigo"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.shareUrl && state.accessCode ? (
        <output className={styles.share}>
          <strong>NUEVA INVITACION / GUARDA EL CODIGO AHORA</strong>
          <span>{state.shareUrl}</span>
          <b>Codigo de acceso: {state.accessCode}</b>
        </output>
      ) : null}
    </form>
  );
}
