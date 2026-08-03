"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  createProposalFromDiagnosticRequest,
  updateDiagnosticRequest
} from "@/app/(admin)/admin/diagnosticos/actions";

import styles from "./diagnostic-request-board.module.css";

type DiagnosticRequestItem = {
  companyName: string | null;
  contactName: string;
  createdAt: string;
  email: string;
  id: string;
  message: string;
  phone: string | null;
  privateNotes: string | null;
  proposalId: string | null;
  service: string;
  status: "NEW" | "CONTACTED" | "QUALIFIED" | "PROPOSAL" | "WON" | "LOST" | "ARCHIVED";
  timeline: string | null;
};

const statusLabels: Record<DiagnosticRequestItem["status"], string> = {
  ARCHIVED: "Archivado",
  CONTACTED: "Contactado",
  LOST: "No continuó",
  NEW: "Nuevo",
  PROPOSAL: "Propuesta",
  QUALIFIED: "Calificado",
  WON: "Ganado"
};

function RequestCard({ request }: { request: DiagnosticRequestItem }) {
  const updateAction = updateDiagnosticRequest.bind(null, request.id);
  const proposalAction = createProposalFromDiagnosticRequest.bind(null, request.id);
  const [updateState, updateFormAction, isUpdating] = useActionState(updateAction, {});
  const [proposalState, proposalFormAction, isCreatingProposal] = useActionState(
    proposalAction,
    {}
  );

  return (
    <article className={styles.card} data-testid={`diagnostic-request-${request.id}`}>
      <header>
        <div>
          <p>{request.status}</p>
          <h2>{request.companyName ?? request.contactName}</h2>
          <span>{request.contactName}</span>
        </div>
        <time dateTime={request.createdAt}>
          {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(
            new Date(request.createdAt)
          )}
        </time>
      </header>
      <dl>
        <div>
          <dt>NECESIDAD</dt>
          <dd>{request.service}</dd>
        </div>
        <div>
          <dt>HORIZONTE</dt>
          <dd>{request.timeline ?? "Por definir"}</dd>
        </div>
        <div>
          <dt>CONTACTO</dt>
          <dd>
            <a href={`mailto:${request.email}`}>{request.email}</a>
            {request.phone ? <a href={`tel:${request.phone}`}>{request.phone}</a> : null}
          </dd>
        </div>
      </dl>
      <p className={styles.message}>{request.message}</p>
      <div className={styles.forms}>
        <form action={updateFormAction}>
          <label>
            <span>ESTADO</span>
            <select defaultValue={request.status} name="status">
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>NOTAS INTERNAS</span>
            <textarea
              defaultValue={request.privateNotes ?? ""}
              name="privateNotes"
              rows={3}
            />
          </label>
          <button disabled={isUpdating} type="submit">
            {isUpdating ? "Guardando…" : "Guardar seguimiento"}
          </button>
          {updateState.error ? <p className={styles.error}>{updateState.error}</p> : null}
          {updateState.success ? (
            <p className={styles.success}>{updateState.success}</p>
          ) : null}
        </form>
        <form action={proposalFormAction}>
          {request.proposalId || proposalState.proposalId ? (
            <Link
              href={`/admin/propuestas/${proposalState.proposalId ?? request.proposalId}`}
            >
              Abrir borrador vinculado
            </Link>
          ) : (
            <button
              disabled={
                isCreatingProposal ||
                request.status === "LOST" ||
                request.status === "ARCHIVED"
              }
              type="submit"
            >
              {isCreatingProposal ? "Creando borrador…" : "Crear propuesta"}
            </button>
          )}
          {proposalState.error ? (
            <p className={styles.error}>{proposalState.error}</p>
          ) : null}
          {proposalState.success ? (
            <p className={styles.success}>{proposalState.success}</p>
          ) : null}
        </form>
      </div>
    </article>
  );
}

export function DiagnosticRequestBoard({
  requests
}: {
  requests: DiagnosticRequestItem[];
}) {
  if (!requests.length) {
    return (
      <section className={styles.empty}>
        <h2>Aún no hay diagnósticos por revisar.</h2>
        <p>Las solicitudes que entren desde contacto aparecerán aquí de forma privada.</p>
      </section>
    );
  }

  return (
    <div className={styles.list}>
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
