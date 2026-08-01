"use client";

import { useActionState } from "react";

import { createProposal } from "@/app/(admin)/admin/propuestas/actions";

import styles from "./proposal-create-form.module.css";

export function ProposalCreateForm() {
  const [state, formAction, isPending] = useActionState(createProposal, {});

  return (
    <form action={formAction} className={styles.form}>
      <div>
        <p>NEW / PROPOSAL_DRAFT</p>
        <h2>Arranca con el problema, no con una plantilla.</h2>
      </div>
      <label>
        <span>CONTACTO / REQUIRED</span>
        <input name="clientName" required type="text" />
      </label>
      <label>
        <span>ORGANIZACIÓN</span>
        <input name="companyName" type="text" />
      </label>
      <label>
        <span>CORREO / REQUIRED</span>
        <input name="clientEmail" required type="email" />
      </label>
      <label>
        <span>TÍTULO / REQUIRED</span>
        <input name="title" required type="text" />
      </label>
      <label className={styles.context}>
        <span>CONTEXTO Y OBJETIVO / REQUIRED</span>
        <textarea name="context" required rows={5} />
      </label>
      <button disabled={isPending} type="submit">
        {isPending ? "Creando propuesta…" : "Crear propuesta privada"}
      </button>
      {state.error ? <p className={styles.error}>{state.error}</p> : null}
      {state.shareUrl && state.accessCode ? (
        <output className={styles.share}>
          <strong>INVITACIÓN CREADA / GUARDA EL CÓDIGO AHORA</strong>
          <span>{state.shareUrl}</span>
          <b>Código de acceso: {state.accessCode}</b>
        </output>
      ) : null}
    </form>
  );
}
