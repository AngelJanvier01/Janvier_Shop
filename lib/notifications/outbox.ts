import { randomUUID } from "node:crypto";

import type { EmailNotificationKind } from "@/app/generated/prisma/client";
import { database } from "@/lib/database";

import { getEmailConfiguration } from "./config";
import { createJanvierEmail } from "./templates";

type QueueAdminEmailInput = {
  dedupeKey?: string;
  details?: Array<{ label: string; value: string }>;
  kind: EmailNotificationKind;
  proposalEventId?: string;
  subject: string;
  summary: string;
  title: string;
  tone?: "alert" | "signal" | "neutral";
};

export async function queueAdminEmail(input: QueueAdminEmailInput) {
  const configuration = getEmailConfiguration();
  if (!configuration.isEnabled || !configuration.isConfigured) {
    return { queued: 0 };
  }

  const email = createJanvierEmail({
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
      proposalEventId: input.proposalEventId,
      recipient,
      subject: input.subject,
      text: email.text
    })),
    skipDuplicates: true
  });
  return { queued: result.count };
}

export async function queueAdminEmailSafely(input: QueueAdminEmailInput) {
  try {
    return await queueAdminEmail(input);
  } catch (error) {
    console.error("JANVIER email outbox enqueue failed", error);
    return { queued: 0 };
  }
}
