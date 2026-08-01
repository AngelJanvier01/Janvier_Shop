"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const proposalInput = z.object({
  clientEmail: z.string().email().max(320),
  clientName: z.string().trim().min(2).max(160),
  companyName: z.string().trim().max(160).optional(),
  context: z.string().trim().min(12).max(4000),
  title: z.string().trim().min(4).max(180)
});

function reference() {
  return `JAN-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function createProposal(formData: FormData) {
  const admin = await requireCurrentAdmin();
  const parsed = proposalInput.safeParse({
    clientEmail: formData.get("clientEmail"),
    clientName: formData.get("clientName"),
    companyName: formData.get("companyName") || undefined,
    context: formData.get("context"),
    title: formData.get("title")
  });
  if (!parsed.success) {
    throw new Error("Los datos de la propuesta no son válidos.");
  }

  const input = parsed.data;
  await database.$transaction(async (transaction) => {
    const client = await transaction.client.create({
      data: {
        companyName: input.companyName || null,
        contactName: input.clientName,
        email: input.clientEmail.toLowerCase()
      }
    });
    const proposal = await transaction.proposal.create({
      data: {
        clientId: client.id,
        ownerId: admin.id,
        reference: reference(),
        title: input.title
      }
    });
    const revision = await transaction.proposalRevision.create({
      data: {
        authorId: admin.id,
        introduction: input.context,
        proposalId: proposal.id,
        revision: 1,
        title: input.title
      }
    });
    await transaction.proposalSection.create({
      data: {
        content: input.context,
        position: 1,
        revisionId: revision.id,
        title: "Contexto y objetivo",
        type: "CONTEXT"
      }
    });
    await transaction.proposalEvent.create({
      data: {
        adminActorId: admin.id,
        proposalId: proposal.id,
        revisionId: revision.id,
        type: "CREATED"
      }
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/propuestas");
  redirect("/admin/propuestas");
}
