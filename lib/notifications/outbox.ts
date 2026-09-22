import { randomUUID } from "node:crypto";

import type { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "./config";
import { createJanvierEmail, sanitizeEmailSubject } from "./templates";

function attachmentBytes(content: Buffer | undefined) {
  return content ? new Uint8Array(content) : undefined;
}

type QueueAdminEmailInput = {
  actionLabel?: string;
  actionUrl?: string;
  attachment?: {
    content: Buffer;
    contentType: string;
    filename: string;
  };
  dedupeKey?: string;
  details?: Array<{ label: string; value: string }>;
  kind: EmailNotificationKind;
  proposalEventId?: string;
  sicoddSyncRunId?: string;
  priority?: number;
  subject: string;
  summary: string;
  title: string;
  tone?: "alert" | "signal" | "neutral";
};

type QueueRecipientEmailInput = {
  attachment?: {
    content: Buffer;
    contentType: string;
    filename: string;
  };
  dedupeKey: string;
  html: string;
  kind: EmailNotificationKind;
  priority?: number;
  recipient: string;
  subject: string;
  text: string;
};

export async function queueRecipientEmail(input: QueueRecipientEmailInput) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled) {
    return { dedupeKey: input.dedupeKey, queued: 0 };
  }

  const result = await database.emailOutbox.createMany({
    data: [
      {
        attachmentContentType: input.attachment?.contentType,
        attachmentData: attachmentBytes(input.attachment?.content),
        attachmentFilename: input.attachment?.filename,
        dedupeKey: input.dedupeKey,
        html: input.html,
        kind: input.kind,
        priority: input.priority ?? 0,
        recipient: input.recipient,
        subject: sanitizeEmailSubject(input.subject),
        text: input.text
      }
    ],
    skipDuplicates: true
  });
  return { dedupeKey: input.dedupeKey, queued: result.count };
}

export async function queueAdminEmail(input: QueueAdminEmailInput) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !configuration.alertRecipients.length) {
    return { queued: 0 };
  }

  const email = createJanvierEmail({
    actionLabel: input.actionLabel,
    actionUrl: input.actionUrl,
    details: input.details,
    eyebrow: input.kind.replaceAll("_", " / "),
    summary: input.summary,
    title: input.title,
    tone: input.tone
  });
  const baseDedupeKey = input.dedupeKey ?? `${input.kind}:${randomUUID()}`;
  const result = await database.emailOutbox.createMany({
    data: configuration.alertRecipients.map((recipient) => ({
      attachmentContentType: input.attachment?.contentType,
      attachmentData: attachmentBytes(input.attachment?.content),
      attachmentFilename: input.attachment?.filename,
      dedupeKey: `${baseDedupeKey}:${recipient}`,
      html: email.html,
      kind: input.kind,
      priority: input.priority ?? 0,
      proposalEventId: input.proposalEventId,
      recipient,
      subject: sanitizeEmailSubject(input.subject),
      sicoddSyncRunId: input.sicoddSyncRunId,
      text: email.text
    })),
    skipDuplicates: true
  });
  return { dedupeKey: baseDedupeKey, queued: result.count };
}

export async function queueAdminEmailSafely(input: QueueAdminEmailInput) {
  try {
    return await queueAdminEmail(input);
  } catch (error) {
    console.error("JANVIER email outbox enqueue failed", error);
    return { dedupeKey: input.dedupeKey, queued: 0 };
  }
}
