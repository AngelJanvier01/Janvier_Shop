"use client";

import { useActionState } from "react";

import {
  issueProposalInvite,
  type IssueProposalInviteState
} from "@/app/(admin)/admin/propuestas/actions";

import { ProposalInviteCard } from "./proposal-invite-card";

import styles from "./proposal-invite-issue.module.css";

type ProposalInviteIssueProps = {
  proposalId: string;
  proposalReference: string;
  proposalTitle: string;
};

const initialState: IssueProposalInviteState = {};

export function ProposalInviteIssue({
  proposalId,
  proposalReference,
  proposalTitle
}: ProposalInviteIssueProps) {
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
        <div className={styles.share} role="status">
          <strong>NUEVA INVITACION / GUARDA EL CODIGO AHORA</strong>
          <span>{state.shareUrl}</span>
          <b>Codigo de acceso: {state.accessCode}</b>
          <ProposalInviteCard
            accessCode={state.accessCode}
            proposalReference={proposalReference}
            proposalTitle={proposalTitle}
            shareUrl={state.shareUrl}
          />
        </div>
      ) : null}
    </form>
  );
}
