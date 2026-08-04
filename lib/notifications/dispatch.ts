import nodemailer from "nodemailer";

import {
  EmailNotificationKind,
  EmailOutboxStatus,
  type ProposalEventType
} from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { assertEmailConfiguration, getEmailConfiguration } from "./config";
import { queueAdminEmail } from "./outbox";

const proposalEventCopy: Partial<
  Record<
    ProposalEventType,
    { summary: string; title: string; tone: "alert" | "signal" | "neutral" }
  >
> = {
  CHANGES_REQUESTED: {
    summary: "El cliente solicitó ajustes a una propuesta compartida.",
    title: "Cambios solicitados en propuesta",
    tone: "alert"
  },
  COMMENT_CREATED: {
    summary: "Hay un comentario nuevo en una propuesta compartida.",
    title: "Nuevo comentario de propuesta",
    tone: "signal"
  },
  INVITE_REVOKED: {
    summary: "Se revocó el acceso activo de una propuesta.",
    title: "Acceso de propuesta revocado",
    tone: "alert"
  },
  INVITE_VIEWED: {
    summary: "El destinatario abrió una propuesta compartida.",
    title: "Propuesta vista",
    tone: "signal"
  },
  PROPOSAL_ACCEPTED: {
    summary: "El cliente aceptó una alternativa de propuesta.",
    title: "Propuesta aceptada",
    tone: "signal"
  },
  PROPOSAL_ASSET_GC_FAILED: {
    summary: "La limpieza de un activo privado de propuesta no se pudo completar.",
    title: "Atención requerida en activo privado",
    tone: "alert"
  },
  PROPOSAL_COMMERCIAL_CONFLICT: {
    summary:
      "Se detectó un conflicto al calcular información comercial de una propuesta.",
    title: "Conflicto comercial detectado",
    tone: "alert"
  },
  PROPOSAL_CREATED: {
    summary:
      "Se creó un nuevo borrador de propuesta desde una solicitud o el panel administrativo.",
    title: "Nuevo borrador de propuesta",
    tone: "neutral"
  },
  PROPOSAL_DECLINED: {
    summary: "El cliente rechazó una alternativa de propuesta.",
    title: "Propuesta rechazada",
    tone: "alert"
  },
  REVISION_SHARED: {
    summary: "Una revisión fue congelada y compartida con su destinatario.",
    title: "Propuesta compartida",
    tone: "signal"
  }
};

const claimTimeoutMilliseconds = 10 * 60_000;
const maximumAttempts = 5;
const retryDelaysMilliseconds = [60_000, 5 * 60_000, 20 * 60_000, 60 * 60_000];

function retryDate(attempts: number) {
  const delay =
    retryDelaysMilliseconds[Math.min(attempts - 1, retryDelaysMilliseconds.length - 1)];
  return new Date(Date.now() + delay);
}

export async function synchronizeProposalEventNotifications(limit = 50) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !configuration.isConfigured) {
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
      dedupeKey: `proposal-event:${event.id}`,
      details: [
        { label: "Propuesta", value: event.proposal.reference },
        { label: "Cliente", value: clientName },
        ...(event.adminActor
          ? [{ label: "Acción por", value: event.adminActor.email }]
          : [])
      ],
      kind: EmailNotificationKind.PROPOSAL_EVENT,
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

export async function dispatchPendingEmails(limit = 20) {
  const currentConfiguration = getEmailConfiguration();
  if (!currentConfiguration.isEnabled) {
    return { failed: 0, sent: 0 };
  }
  const configuration = assertEmailConfiguration();
  const now = new Date();
  await database.emailOutbox.updateMany({
    data: { claimedAt: null, status: EmailOutboxStatus.RETRY },
    where: {
      claimedAt: { lt: new Date(now.getTime() - claimTimeoutMilliseconds) },
      status: EmailOutboxStatus.PROCESSING
    }
  });
  const candidates = await database.emailOutbox.findMany({
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: limit,
    where: {
      nextAttemptAt: { lte: now },
      status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] }
    }
  });
  const transport = nodemailer.createTransport({
    auth: { pass: configuration.smtp.password, user: configuration.smtp.user },
    host: configuration.smtp.host,
    port: configuration.smtp.port,
    secure: configuration.smtp.port === 465,
    tls: { minVersion: "TLSv1.2" }
  });
  let failed = 0;
  let sent = 0;

  for (const candidate of candidates) {
    const claim = await database.emailOutbox.updateMany({
      data: {
        attempts: { increment: 1 },
        claimedAt: new Date(),
        status: EmailOutboxStatus.PROCESSING
      },
      where: {
        id: candidate.id,
        nextAttemptAt: { lte: new Date() },
        status: { in: [EmailOutboxStatus.PENDING, EmailOutboxStatus.RETRY] }
      }
    });
    if (!claim.count) continue;

    try {
      await transport.sendMail({
        from: configuration.from,
        html: candidate.html,
        text: candidate.text,
        to: candidate.recipient,
        subject: candidate.subject
      });
      await database.emailOutbox.update({
        data: { lastError: null, sentAt: new Date(), status: EmailOutboxStatus.SENT },
        where: { id: candidate.id }
      });
      sent += 1;
    } catch (error) {
      const attempts = candidate.attempts + 1;
      await database.emailOutbox.update({
        data: {
          claimedAt: null,
          lastError:
            error instanceof Error
              ? error.message.slice(0, 2000)
              : "Fallo desconocido al enviar correo.",
          nextAttemptAt: retryDate(attempts),
          status:
            attempts >= maximumAttempts
              ? EmailOutboxStatus.FAILED
              : EmailOutboxStatus.RETRY
        },
        where: { id: candidate.id }
      });
      failed += 1;
    }
  }
  return { failed, sent };
}
