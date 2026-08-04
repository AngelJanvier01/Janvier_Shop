import { randomUUID } from "node:crypto";

import {
  EmailNotificationKind,
  EmailOutboxStatus,
  type ProposalEventType
} from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "./config";
import { getDeliveryProvider } from "./delivery-provider";
import { emailOutboxMessageId } from "./message-id";
import { queueAdminEmail } from "./outbox";

const proposalEventCopy: Partial<
  Record<
    ProposalEventType,
    { summary: string; title: string; tone: "alert" | "signal" | "neutral" }
  >
> = {
  CHANGES_REQUESTED: {
    summary: "El cliente solicito ajustes a una propuesta compartida.",
    title: "Cambios solicitados en propuesta",
    tone: "alert"
  },
  COMMENT_CREATED: {
    summary: "Hay un comentario nuevo en una propuesta compartida.",
    title: "Nuevo comentario de propuesta",
    tone: "signal"
  },
  INVITE_REVOKED: {
    summary: "Se revoco el acceso activo de una propuesta.",
    title: "Acceso de propuesta revocado",
    tone: "alert"
  },
  INVITE_VIEWED: {
    summary: "El destinatario abrio una propuesta compartida.",
    title: "Propuesta vista",
    tone: "signal"
  },
  PROPOSAL_ACCEPTED: {
    summary: "El cliente acepto una alternativa de propuesta.",
    title: "Propuesta aceptada",
    tone: "signal"
  },
  PROPOSAL_ASSET_GC_FAILED: {
    summary: "La limpieza de un activo privado de propuesta no se pudo completar.",
    title: "Atencion requerida en activo privado",
    tone: "alert"
  },
  PROPOSAL_COMMERCIAL_CONFLICT: {
    summary:
      "Se detecto un conflicto al calcular informacion comercial de una propuesta.",
    title: "Conflicto comercial detectado",
    tone: "alert"
  },
  PROPOSAL_CREATED: {
    summary:
      "Se creo un nuevo borrador de propuesta desde una solicitud o el panel administrativo.",
    title: "Nuevo borrador de propuesta",
    tone: "neutral"
  },
  PROPOSAL_DECLINED: {
    summary: "El cliente rechazo una alternativa de propuesta.",
    title: "Propuesta rechazada",
    tone: "alert"
  },
  REVISION_SHARED: {
    summary: "Una revision fue congelada y compartida con su destinatario.",
    title: "Propuesta compartida",
    tone: "signal"
  }
};

type ClaimedEmail = {
  attempts: number;
  html: string;
  id: string;
  kind: EmailNotificationKind;
  maxAttempts: number;
  recipient: string;
  subject: string;
  text: string;
};

const claimTimeoutMilliseconds = 10 * 60_000;
const retryDelaysMilliseconds = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];

function retryDate(attempts: number) {
  const delay =
    retryDelaysMilliseconds[Math.min(attempts - 1, retryDelaysMilliseconds.length - 1)];
  const jitter = Math.floor(Math.random() * 5_000);
  return new Date(Date.now() + delay + jitter);
}

function workerIdentifier() {
  return `${process.env.HOSTNAME || "janvier"}:${process.pid}:${randomUUID()}`.slice(
    0,
    96
  );
}

function logDelivery(data: Record<string, string | number | boolean>) {
  console.info(JSON.stringify({ component: "email-worker", ...data }));
}

async function recoverAbandonedEmails() {
  const cutoff = new Date(Date.now() - claimTimeoutMilliseconds);
  return database.emailOutbox.updateMany({
    data: {
      lastErrorCode: "WORKER_TIMEOUT",
      lastErrorMessage:
        "El worker anterior no confirmo el resultado dentro del tiempo limite.",
      lockedAt: null,
      lockedBy: null,
      nextAttemptAt: new Date(),
      recoveries: { increment: 1 },
      status: EmailOutboxStatus.RETRY
    },
    where: { lockedAt: { lt: cutoff }, status: EmailOutboxStatus.PROCESSING }
  });
}

async function claimPendingEmails(
  limit: number,
  workerId: string,
  dedupePrefix?: string
) {
  return database.$queryRaw<ClaimedEmail[]>`
    WITH candidates AS (
      SELECT "id"
      FROM "EmailOutbox"
      WHERE "status" IN ('PENDING'::"EmailOutboxStatus", 'RETRY'::"EmailOutboxStatus")
        AND "nextAttemptAt" <= NOW()
        AND (${dedupePrefix ?? null}::text IS NULL OR "dedupeKey" LIKE ${dedupePrefix ? `${dedupePrefix}%` : null})
      ORDER BY "priority" DESC, "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    )
    UPDATE "EmailOutbox" AS outbox
    SET "attempts" = outbox."attempts" + 1,
        "lockedAt" = NOW(),
        "lockedBy" = ${workerId},
        "status" = 'PROCESSING'::"EmailOutboxStatus",
        "updatedAt" = NOW()
    FROM candidates
    WHERE outbox."id" = candidates."id"
    RETURNING outbox."id", outbox."kind", outbox."recipient", outbox."subject",
      outbox."html", outbox."text", outbox."attempts", outbox."maxAttempts";
  `;
}

export async function synchronizeProposalEventNotifications(limit = 50) {
  const configuration = getEmailConfiguration();
  const provider = await getDeliveryProvider();
  if (!configuration.isEnabled || !(await provider.validateConfiguration()).ok) {
    return { queued: 0 };
  }

  const events = await database.proposalEvent.findMany({
    include: {
      adminActor: { select: { email: true } },
      proposal: {
        include: { client: { select: { companyName: true, contactName: true } } }
      }
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    where: {
      emailOutbox: { none: { kind: EmailNotificationKind.PROPOSAL_EVENT } },
      type: { in: Object.keys(proposalEventCopy) as ProposalEventType[] }
    }
  });
  let queued = 0;
  for (const event of events) {
    const copy = proposalEventCopy[event.type];
    if (!copy) continue;
    const clientName =
      event.proposal.client.companyName || event.proposal.client.contactName;
    const result = await queueAdminEmail({
      actionLabel: "Abrir panel privado",
      actionUrl: `${configuration.appUrl}/admin`,
      dedupeKey: `proposal-event:${event.id}`,
      details: [
        { label: "Evento", value: event.type },
        { label: "Propuesta", value: event.proposal.reference },
        { label: "Cliente", value: clientName },
        ...(event.adminActor
          ? [{ label: "Accion por", value: event.adminActor.email }]
          : [])
      ],
      kind: EmailNotificationKind.PROPOSAL_EVENT,
      priority: copy.tone === "alert" ? 20 : 10,
      proposalEventId: event.id,
      subject: `JANVIER · ${copy.title} · ${event.proposal.reference}`,
      summary: copy.summary,
      title: copy.title,
      tone: copy.tone
    });
    queued += result.queued;
  }
  return { queued };
}

export async function dispatchPendingEmails(limit = 20, dedupePrefix?: string) {
  const currentConfiguration = getEmailConfiguration();
  if (!currentConfiguration.isEnabled) return { failed: 0, recovered: 0, sent: 0 };
  const provider = await getDeliveryProvider();
  const validation = await provider.validateConfiguration();
  if (!validation.ok) return { failed: 0, recovered: 0, sent: 0 };
  const recovered = await recoverAbandonedEmails();
  const workerId = workerIdentifier();
  const candidates = await claimPendingEmails(limit, workerId, dedupePrefix);
  if (!candidates.length) return { failed: 0, recovered: recovered.count, sent: 0 };

  let failed = 0;
  let sent = 0;

  for (const candidate of candidates) {
    const startedAt = Date.now();
    try {
      await provider.sendMessage({
        html: candidate.html,
        messageId: emailOutboxMessageId(candidate.id, currentConfiguration.appUrl),
        text: candidate.text,
        recipient: candidate.recipient,
        subject: candidate.subject
      });
      const result = await database.emailOutbox.updateMany({
        data: {
          lastErrorCode: null,
          lastErrorMessage: null,
          lockedAt: null,
          lockedBy: null,
          sentAt: new Date(),
          status: EmailOutboxStatus.SENT
        },
        where: {
          id: candidate.id,
          lockedBy: workerId,
          status: EmailOutboxStatus.PROCESSING
        }
      });
      if (result.count) {
        sent += 1;
        logDelivery({
          attempt: candidate.attempts,
          durationMs: Date.now() - startedAt,
          eventType: candidate.kind,
          jobId: candidate.id,
          outcome: "sent"
        });
      }
    } catch (error) {
      const failure = provider.sanitizeError(error);
      if (failure.reconnect) {
        await database.$transaction([
          database.notificationDeliveryConfiguration.updateMany({
            data: {
              deliveryEnabled: false,
              lastFailureAt: new Date(),
              lastFailureCode: failure.code,
              providerStatus: "REVOKED"
            },
            where: { provider: "GMAIL_API" }
          }),
          database.$executeRaw`
            UPDATE "EmailOutbox"
            SET "attempts" = GREATEST("attempts" - 1, 0),
                "lockedAt" = NULL,
                "lockedBy" = NULL,
                "nextAttemptAt" = NOW(),
                "status" = 'RETRY'::"EmailOutboxStatus",
                "updatedAt" = NOW()
            WHERE "lockedBy" = ${workerId}
              AND "status" = 'PROCESSING'::"EmailOutboxStatus"
          `
        ]);
        logDelivery({
          attempt: candidate.attempts,
          durationMs: Date.now() - startedAt,
          errorCode: failure.code,
          eventType: candidate.kind,
          jobId: candidate.id,
          outcome: "reconnect-required"
        });
        break;
      }
      const isTerminal = failure.permanent || candidate.attempts >= candidate.maxAttempts;
      await database.emailOutbox.updateMany({
        data: {
          failedAt: isTerminal ? new Date() : null,
          lastErrorCode: failure.code,
          lastErrorMessage: failure.message,
          lockedAt: null,
          lockedBy: null,
          nextAttemptAt: isTerminal ? new Date() : retryDate(candidate.attempts),
          status: isTerminal ? EmailOutboxStatus.DEAD : EmailOutboxStatus.RETRY
        },
        where: {
          id: candidate.id,
          lockedBy: workerId,
          status: EmailOutboxStatus.PROCESSING
        }
      });
      failed += 1;
      logDelivery({
        attempt: candidate.attempts,
        durationMs: Date.now() - startedAt,
        errorCode: failure.code,
        eventType: candidate.kind,
        jobId: candidate.id,
        outcome: isTerminal ? "dead" : "retry"
      });
    }
  }
  return { failed, recovered: recovered.count, sent };
}
