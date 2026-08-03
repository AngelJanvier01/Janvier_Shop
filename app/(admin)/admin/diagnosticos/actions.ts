"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";

const diagnosticStatuses = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
  "ARCHIVED"
] as const;

const diagnosticUpdateInput = z.object({
  privateNotes: z.string().trim().max(4000),
  status: z.enum(diagnosticStatuses)
});

type DiagnosticActionState = {
  error?: string;
  proposalId?: string;
  success?: string;
};

function proposalReference() {
  return `JAN-${new Date().getFullYear()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function proposalTitle(service: string, companyName: string | null, contactName: string) {
  const subject = companyName || contactName;
  return `${service} / ${subject}`.slice(0, 180);
}

function invalidateDiagnostics(id?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/diagnosticos");
  if (id) revalidatePath(`/admin/propuestas/${id}`);
  revalidatePath("/admin/propuestas");
}

export async function updateDiagnosticRequest(
  requestId: string,
  _previousState: DiagnosticActionState,
  formData: FormData
): Promise<DiagnosticActionState> {
  void _previousState;
  const admin = await requireCurrentAdmin();
  const parsed = diagnosticUpdateInput.safeParse({
    privateNotes: formData.get("privateNotes") ?? "",
    status: formData.get("status")
  });
  if (!parsed.success) {
    return { error: "Revisa el estado y las notas antes de guardar." };
  }

  const current = await database.diagnosticRequest.findUnique({
    select: { id: true, status: true },
    where: { id: requestId }
  });
  if (!current) return { error: "Esta solicitud ya no existe." };

  const now = new Date();
  const nextStatus = parsed.data.status;
  await database.diagnosticRequest.update({
    data: {
      closedAt: ["WON", "LOST", "ARCHIVED"].includes(nextStatus) ? now : null,
      contactedAt:
        nextStatus === "CONTACTED" ||
        nextStatus === "QUALIFIED" ||
        nextStatus === "PROPOSAL"
          ? now
          : undefined,
      ownerId: admin.id,
      privateNotes: parsed.data.privateNotes || null,
      qualifiedAt:
        nextStatus === "QUALIFIED" || nextStatus === "PROPOSAL" || nextStatus === "WON"
          ? now
          : undefined,
      status: nextStatus
    },
    where: { id: current.id }
  });

  invalidateDiagnostics();
  return { success: "Solicitud actualizada." };
}

export async function createProposalFromDiagnosticRequest(
  requestId: string,
  _previousState: DiagnosticActionState,
  formData: FormData
): Promise<DiagnosticActionState> {
  void _previousState;
  void formData;
  const admin = await requireCurrentAdmin();

  try {
    const result = await database.$transaction(async (transaction) => {
      const request = await transaction.diagnosticRequest.findUnique({
        where: { id: requestId }
      });
      if (!request) throw new Error("La solicitud ya no existe.");
      if (request.proposalId) return { proposalId: request.proposalId, reused: true };
      if (["LOST", "ARCHIVED"].includes(request.status)) {
        throw new Error("Recupera la solicitud antes de crear una propuesta.");
      }

      const existingClient = await transaction.client.findFirst({
        orderBy: { updatedAt: "desc" },
        where: { email: request.email }
      });
      const client =
        existingClient ??
        (await transaction.client.create({
          data: {
            companyName: request.companyName,
            contactName: request.contactName,
            email: request.email,
            phone: request.phone
          }
        }));
      const title = proposalTitle(
        request.service,
        request.companyName,
        request.contactName
      );
      const proposal = await transaction.proposal.create({
        data: {
          clientId: client.id,
          ownerId: admin.id,
          reference: proposalReference(),
          title
        }
      });
      const revision = await transaction.proposalRevision.create({
        data: {
          authorId: admin.id,
          introduction: request.message,
          proposalId: proposal.id,
          revision: 1,
          title
        }
      });
      await transaction.proposalSection.create({
        data: {
          content: request.message,
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
          type: "PROPOSAL_CREATED"
        }
      });
      await transaction.diagnosticRequest.update({
        data: {
          clientId: client.id,
          ownerId: admin.id,
          proposalId: proposal.id,
          qualifiedAt: request.qualifiedAt ?? new Date(),
          status: "PROPOSAL"
        },
        where: { id: request.id }
      });
      return { proposalId: proposal.id, reused: false };
    });

    invalidateDiagnostics(result.proposalId);
    return {
      proposalId: result.proposalId,
      success: result.reused
        ? "Esta solicitud ya tenía un borrador vinculado."
        : "Borrador creado desde el diagnóstico."
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo crear el borrador."
    };
  }
}
