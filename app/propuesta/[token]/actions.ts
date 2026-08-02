"use server";

import { randomBytes } from "node:crypto";
import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { database } from "@/lib/database";
import {
  developmentInviteCodeVerification,
  proposalVerificationMethod
} from "@/lib/proposals/acceptance-verification";
import {
  proposalAccessCookieLifetimeSeconds,
  proposalAccessCookieName,
  createProposalAccessCookie,
  verifyProposalAccessCookie
} from "@/lib/proposals/invite-access";
import {
  hashInviteToken,
  verifyProposalInviteCode
} from "@/lib/proposals/invite-security";
import {
  assertProposalCanDecide,
  assertProposalCanSelectOption,
  canReadProjectRoom,
  proposalStatus,
  shouldRecordProposalView,
  transitionProposal,
  ProposalStateError
} from "@/lib/proposals/proposal-state";
import { buildProposalAcceptanceSnapshot } from "@/lib/proposals/proposal-snapshot";

export type ProposalAccessState = {
  error?: string;
};

type ProposalInteractionState = {
  error?: string;
  success?: string;
};

const maximumAccessAttempts = 5;
const accessAttemptWindowMs = 15 * 60 * 1000;

const identityInput = z.object({
  authorEmail: z.string().trim().email().max(320),
  authorName: z.string().trim().min(2).max(160)
});

const commentInput = identityInput.extend({
  content: z.string().trim().min(4).max(4000)
});

const decisionInput = identityInput.extend({
  company: z.string().trim().max(160),
  decision: z.enum(["ACCEPT", "DECLINE", "REQUEST_CHANGES"]),
  note: z.string().trim().max(4000),
  role: z.string().trim().max(160),
  termsAccepted: z.boolean(),
  verificationCode: z.string().trim().max(64)
});

const optionSelectionInput = z.object({
  optionId: z.string().trim().min(8).max(128)
});

function getRequestMetadata(headerValues: Headers) {
  const forwarded = headerValues.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || headerValues.get("x-real-ip") || null,
    userAgent: headerValues.get("user-agent")?.slice(0, 1000) || null
  };
}

async function resolveAuthorizedInvite(token: string) {
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: {
      proposal: { select: { status: true } }
    }
  });
  if (
    !invite ||
    invite.status !== "ACTIVE" ||
    invite.expiresAt.getTime() <= Date.now() ||
    !canReadProjectRoom(invite.proposal.status)
  ) {
    return null;
  }

  const cookieStore = await cookies();
  return verifyProposalAccessCookie(
    token,
    cookieStore.get(proposalAccessCookieName(token))?.value
  )
    ? invite
    : null;
}

export async function unlockProposalInvite(
  token: string,
  _previousState: ProposalAccessState,
  formData: FormData
): Promise<ProposalAccessState> {
  void _previousState;
  const accessCode = String(formData.get("accessCode") ?? "");
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { proposal: { select: { status: true } } }
  });
  if (
    !invite ||
    invite.status !== "ACTIVE" ||
    invite.expiresAt.getTime() <= Date.now() ||
    !canReadProjectRoom(invite.proposal.status)
  ) {
    return {
      error: "No pudimos validar ese código. Revisa la invitación e inténtalo de nuevo."
    };
  }

  const attemptWindowStart = new Date(Date.now() - accessAttemptWindowMs);
  const recentAttempts = await database.proposalInviteAttempt.count({
    where: { createdAt: { gte: attemptWindowStart }, inviteId: invite.id }
  });
  if (recentAttempts >= maximumAccessAttempts) {
    return {
      error: "Por seguridad, espera unos minutos antes de volver a intentar el código."
    };
  }
  if (!(await verifyProposalInviteCode(accessCode, invite.codeHash))) {
    await database.proposalInviteAttempt.create({ data: { inviteId: invite.id } });
    return {
      error: "No pudimos validar ese código. Revisa la invitación e inténtalo de nuevo."
    };
  }

  const now = new Date();
  const metadata = getRequestMetadata(await headers());
  await database.$transaction(async (transaction) => {
    await transaction.proposalInviteAttempt.deleteMany({
      where: { createdAt: { gte: attemptWindowStart }, inviteId: invite.id }
    });
    await transaction.proposalInvite.update({
      where: { id: invite.id },
      data: {
        firstViewedAt: invite.firstViewedAt ?? now,
        lastViewedAt: now,
        viewCount: { increment: 1 }
      }
    });
    if (shouldRecordProposalView(invite.proposal.status)) {
      await transaction.proposal.update({
        where: { id: invite.proposalId },
        data: {
          ...transitionProposal(invite.proposal.status, proposalStatus.VIEWED),
          firstViewedAt: now
        }
      });
    }
    await transaction.proposalEvent.create({
      data: {
        metadata: { inviteId: invite.id, ...metadata },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "INVITE_VIEWED"
      }
    });
  });

  const cookieStore = await cookies();
  const maxAge = Math.min(
    proposalAccessCookieLifetimeSeconds,
    Math.max(1, Math.floor((invite.expiresAt.getTime() - Date.now()) / 1000))
  );
  cookieStore.set({
    expires: invite.expiresAt,
    httpOnly: true,
    maxAge,
    name: proposalAccessCookieName(token),
    path: `/propuesta/${token}`,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    value: createProposalAccessCookie(token, invite.expiresAt)
  });

  redirect(`/propuesta/${token}`);
}

export async function selectProposalOption(
  token: string,
  _previousState: ProposalInteractionState,
  formData: FormData
): Promise<ProposalInteractionState> {
  void _previousState;
  const parsed = optionSelectionInput.safeParse({ optionId: formData.get("optionId") });
  if (!parsed.success) {
    return { error: "Selecciona una alternativa válida." };
  }
  const invite = await resolveAuthorizedInvite(token);
  if (!invite) {
    return {
      error: "Tu sesión de propuesta ya no está activa. Vuelve a usar el código."
    };
  }
  try {
    assertProposalCanSelectOption(invite.proposal.status);
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "No se puede cambiar la alternativa."
    };
  }
  const metadata = getRequestMetadata(await headers());
  try {
    await database.$transaction(async (transaction) => {
      const currentInvite = await transaction.proposalInvite.findUnique({
        where: { id: invite.id },
        include: { proposal: { select: { status: true } } }
      });
      if (
        !currentInvite ||
        currentInvite.status !== "ACTIVE" ||
        currentInvite.expiresAt.getTime() <= Date.now()
      ) {
        throw new ProposalStateError("La invitación ya no está activa.");
      }
      assertProposalCanSelectOption(currentInvite.proposal.status);
      const option = await transaction.proposalOption.findFirst({
        where: {
          id: parsed.data.optionId,
          isEnabled: true,
          revisionId: currentInvite.revisionId
        },
        select: { id: true }
      });
      if (!option) {
        throw new ProposalStateError(
          "Esa alternativa ya no pertenece a la revisión compartida."
        );
      }
      await transaction.proposal.update({
        where: { id: currentInvite.proposalId },
        data: { selectedOptionId: option.id }
      });
      await transaction.proposalEvent.create({
        data: {
          metadata: { inviteId: currentInvite.id, optionId: option.id, ...metadata },
          proposalId: currentInvite.proposalId,
          revisionId: currentInvite.revisionId,
          type: "OPTION_SELECTED"
        }
      });
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "No se pudo guardar la alternativa."
    };
  }
  revalidatePath(`/propuesta/${token}`);
  return { success: "Alternativa seleccionada. Aún puedes revisar antes de aceptar." };
}

export async function submitProposalComment(
  token: string,
  _previousState: ProposalInteractionState,
  formData: FormData
): Promise<ProposalInteractionState> {
  void _previousState;
  const parsed = commentInput.safeParse({
    authorEmail: formData.get("authorEmail"),
    authorName: formData.get("authorName"),
    content: formData.get("content")
  });
  if (!parsed.success) {
    return { error: "Escribe tu nombre, correo y una nota breve para continuar." };
  }
  const invite = await resolveAuthorizedInvite(token);
  if (!invite) {
    return {
      error: "Tu sesión de propuesta ya no está activa. Vuelve a usar el código."
    };
  }

  const metadata = getRequestMetadata(await headers());
  await database.$transaction([
    database.proposalComment.create({
      data: {
        authorEmail: parsed.data.authorEmail.toLowerCase(),
        authorName: parsed.data.authorName,
        content: parsed.data.content,
        inviteId: invite.id,
        proposalId: invite.proposalId,
        revisionId: invite.revisionId
      }
    }),
    database.proposalEvent.create({
      data: {
        metadata: { inviteId: invite.id, source: "client", ...metadata },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "COMMENT_CREATED"
      }
    })
  ]);
  return { success: "Nota enviada. JANVIER recibió tu mensaje." };
}

export async function submitProposalDecision(
  token: string,
  _previousState: ProposalInteractionState,
  formData: FormData
): Promise<ProposalInteractionState> {
  void _previousState;
  const parsed = decisionInput.safeParse({
    authorEmail: formData.get("authorEmail"),
    authorName: formData.get("authorName"),
    company: formData.get("company") ?? "",
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
    role: formData.get("role") ?? "",
    termsAccepted: formData.get("termsAccepted") === "on",
    verificationCode: formData.get("verificationCode") ?? ""
  });
  if (!parsed.success) {
    return { error: "Completa los datos necesarios para registrar tu decisión." };
  }
  if (parsed.data.decision === "REQUEST_CHANGES" && parsed.data.note.length < 8) {
    return { error: "Danos un poco más de contexto sobre los ajustes que necesitas." };
  }
  if (
    parsed.data.decision === "ACCEPT" &&
    (!parsed.data.termsAccepted ||
      parsed.data.role.length < 2 ||
      !parsed.data.verificationCode)
  ) {
    return { error: "Para aceptar, confirma términos, cargo y código de verificación." };
  }

  const invite = await resolveAuthorizedInvite(token);
  if (!invite) {
    return {
      error: "Tu sesión de propuesta ya no está activa. Vuelve a usar el código."
    };
  }
  const targetEmail = invite.recipientEmail?.toLowerCase();
  if (
    parsed.data.decision === "ACCEPT" &&
    targetEmail !== parsed.data.authorEmail.toLowerCase()
  ) {
    return {
      error: "El correo de aceptación debe coincidir con el destinatario autorizado."
    };
  }
  if (
    parsed.data.decision === "ACCEPT" &&
    !(await developmentInviteCodeVerification.verify({
      code: parsed.data.verificationCode,
      codeHash: invite.codeHash
    }))
  ) {
    return { error: "No pudimos validar el código de verificación." };
  }

  const metadata = getRequestMetadata(await headers());
  try {
    await database.$transaction(async (transaction) => {
      const currentInvite = await transaction.proposalInvite.findUnique({
        where: { id: invite.id },
        select: {
          expiresAt: true,
          proposalId: true,
          revisionId: true,
          status: true
        }
      });
      if (
        !currentInvite ||
        currentInvite.status !== "ACTIVE" ||
        currentInvite.expiresAt.getTime() <= Date.now() ||
        currentInvite.proposalId !== invite.proposalId ||
        currentInvite.revisionId !== invite.revisionId
      ) {
        throw new ProposalStateError("La invitación ya no está activa.");
      }
      const proposal = await transaction.proposal.findUnique({
        where: { id: invite.proposalId },
        include: {
          acceptance: true,
          client: true,
          revisions: {
            where: { id: invite.revisionId },
            include: {
              lineItems: {
                select: {
                  code: true,
                  description: true,
                  discount: true,
                  optionId: true,
                  position: true,
                  quantity: true,
                  taxRate: true,
                  type: true,
                  unitPrice: true,
                  visibleForClient: true
                }
              },
              options: { where: { isEnabled: true } },
              sections: { where: { isIncluded: true } }
            }
          }
        }
      });
      const revision = proposal?.revisions[0];
      if (!proposal || !revision || proposal.acceptance) {
        throw new ProposalStateError(
          "Esta propuesta ya tiene una aceptación registrada."
        );
      }
      const nextStatus = assertProposalCanDecide(proposal.status, parsed.data.decision);
      const selectedOption = proposal.selectedOptionId
        ? (revision.options.find((option) => option.id === proposal.selectedOptionId) ??
          null)
        : null;
      if (
        revision.options.length &&
        !selectedOption &&
        parsed.data.decision === "ACCEPT"
      ) {
        throw new ProposalStateError(
          "Selecciona una alternativa válida antes de aceptar."
        );
      }
      if (proposal.selectedOptionId && !selectedOption) {
        throw new ProposalStateError(
          "La alternativa seleccionada no pertenece a esta revisión."
        );
      }
      const now = new Date();
      await transaction.proposalDecision.create({
        data: {
          acceptedTermsAt: parsed.data.termsAccepted ? now : null,
          actorEmail: parsed.data.authorEmail.toLowerCase(),
          actorName: parsed.data.authorName,
          inviteId: invite.id,
          note: parsed.data.note || null,
          proposalId: invite.proposalId,
          revisionId: invite.revisionId,
          type: parsed.data.decision
        }
      });
      if (parsed.data.note) {
        await transaction.proposalComment.create({
          data: {
            authorEmail: parsed.data.authorEmail.toLowerCase(),
            authorName: parsed.data.authorName,
            content: parsed.data.note,
            inviteId: invite.id,
            proposalId: invite.proposalId,
            revisionId: invite.revisionId
          }
        });
      }
      if (parsed.data.decision === "ACCEPT") {
        const acceptance = buildProposalAcceptanceSnapshot({
          currency: proposal.currency,
          fallbackInvestment: revision.investment,
          lineItems: revision.lineItems,
          revision: revision.revision,
          sections: revision.sections,
          selectedOption,
          terms: revision.terms,
          title: revision.title
        });
        await transaction.proposalAcceptance.create({
          data: {
            company: parsed.data.company || proposal.client.companyName || null,
            contentHash: acceptance.contentHash,
            currency: proposal.currency,
            email: parsed.data.authorEmail.toLowerCase(),
            inviteId: invite.id,
            ip: metadata.ip,
            name: parsed.data.authorName,
            optionId: selectedOption?.id ?? null,
            proposalId: proposal.id,
            revisionId: revision.id,
            role: parsed.data.role,
            snapshot: acceptance.snapshot,
            subtotal: acceptance.totals.subtotal,
            tax: acceptance.totals.tax,
            terms: revision.terms,
            total: acceptance.totals.total,
            userAgent: metadata.userAgent,
            verificationMethod: proposalVerificationMethod
          }
        });
        await transaction.proposalRevision.update({
          where: { id: revision.id },
          data: { lockedAt: revision.lockedAt ?? now }
        });
        const revoked = await transaction.proposalInvite.updateMany({
          where: { proposalId: proposal.id, status: "ACTIVE" },
          data: { revokedAt: now, status: "REVOKED" }
        });
        const project = proposal.projectId
          ? null
          : await transaction.project.create({
              data: {
                clientId: proposal.clientId,
                isPublic: false,
                ownerId: proposal.ownerId,
                slug: `${proposal.reference.toLowerCase()}-${randomBytes(3).toString("hex")}`,
                status: "DRAFT",
                summary:
                  revision.introduction ||
                  `Proyecto creado desde la propuesta aceptada ${proposal.reference}.`,
                title: proposal.title
              }
            });
        await transaction.proposal.update({
          where: { id: proposal.id },
          data: {
            ...transitionProposal(proposal.status, nextStatus),
            acceptedAt: now,
            projectId: project?.id ?? proposal.projectId
          }
        });
        await transaction.proposalEvent.create({
          data: {
            metadata: {
              contentHash: acceptance.contentHash,
              inviteId: invite.id,
              optionId: selectedOption?.id ?? null,
              verificationMethod: proposalVerificationMethod,
              ...metadata
            },
            proposalId: proposal.id,
            revisionId: revision.id,
            type: "PROPOSAL_ACCEPTED"
          }
        });
        if (revoked.count) {
          await transaction.proposalEvent.create({
            data: {
              metadata: { count: revoked.count, reason: "accepted", ...metadata },
              proposalId: proposal.id,
              revisionId: revision.id,
              type: "INVITE_REVOKED"
            }
          });
        }
        if (project) {
          await transaction.proposalEvent.create({
            data: {
              metadata: { projectId: project.id },
              proposalId: proposal.id,
              revisionId: revision.id,
              type: "PROJECT_CREATED"
            }
          });
        }
        return;
      }

      await transaction.proposal.update({
        where: { id: proposal.id },
        data: { ...transitionProposal(proposal.status, nextStatus) }
      });
      await transaction.proposalEvent.create({
        data: {
          metadata: { decision: parsed.data.decision, inviteId: invite.id, ...metadata },
          proposalId: proposal.id,
          revisionId: revision.id,
          type:
            parsed.data.decision === "DECLINE" ? "PROPOSAL_DECLINED" : "CHANGES_REQUESTED"
        }
      });
    });
  } catch (error) {
    if (error instanceof ProposalStateError) {
      return { error: error.message };
    }
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return { error: "Esta propuesta ya tiene una aceptación registrada." };
    }
    throw error;
  }

  revalidatePath(`/propuesta/${token}`);
  return {
    success:
      parsed.data.decision === "ACCEPT"
        ? "Propuesta aceptada. JANVIER recibió tu confirmación."
        : parsed.data.decision === "REQUEST_CHANGES"
          ? "Solicitud de ajustes enviada. Regresaremos con una nueva revisión."
          : "Tu decisión fue registrada. Gracias por tu tiempo."
  };
}
