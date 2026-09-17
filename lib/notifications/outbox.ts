import { randomUUID } from "node:crypto";

import type { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "./config";
import { isDeliveryQueueReady } from "./delivery-provider";
import { createJanvierEmail, sanitizeEmailSubject } from "./templates";

type QueueAdminEmailInput = {
  actionLabel?: string;
  actionUrl?: string;
  dedupeKey?: string;
  details?: Array<{ label: string; value: string }>;
  kind: EmailNotificationKind;
  proposalEventId?: string;
  priority?: number;
  subject: string;
  summary: string;
  title: string;
  tone?: "alert" | "signal" | "neutral";
};

export async function queueAdminEmail(input: QueueAdminEmailInput) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !(await isDeliveryQueueReady())) {
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
      dedupeKey: `${baseDedupeKey}:${recipient}`,
      html: email.html,
      kind: input.kind,
      priority: input.priority ?? 0,
      proposalEventId: input.proposalEventId,
      recipient,
      subject: sanitizeEmailSubject(input.subject),
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
