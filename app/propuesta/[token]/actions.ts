"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { database } from "@/lib/database";
import {
  createProposalAccessCookie,
  proposalAccessCookieLifetimeSeconds,
  proposalAccessCookieName,
  verifyProposalAccessCookie
} from "@/lib/proposals/invite-access";
import {
  hashInviteToken,
  verifyProposalInviteCode
} from "@/lib/proposals/invite-security";

export type ProposalAccessState = {
  error?: string;
};

type ProposalInteractionState = {
  error?: string;
  success?: string;
};

const identityInput = z.object({
  authorEmail: z.string().trim().email().max(320),
  authorName: z.string().trim().min(2).max(160)
});

const commentInput = identityInput.extend({
  content: z.string().trim().min(4).max(4000)
});

const decisionInput = identityInput.extend({
  decision: z.enum(["ACCEPT", "DECLINE", "REQUEST_CHANGES"]),
  note: z.string().trim().max(4000),
  termsAccepted: z.boolean()
});

async function resolveAuthorizedInvite(token: string) {
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      expiresAt: true,
      id: true,
      proposalId: true,
      revisionId: true,
      status: true
    }
  });
  if (!invite || invite.status !== "ACTIVE" || invite.expiresAt.getTime() <= Date.now()) {
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
  const accessCode = String(formData.get("accessCode") ?? "");
  const invite = await database.proposalInvite.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    select: {
      codeHash: true,
      expiresAt: true,
      id: true,
      proposalId: true,
      revisionId: true,
      status: true
    }
  });

  if (
    !invite ||
    invite.status !== "ACTIVE" ||
    invite.expiresAt.getTime() <= Date.now() ||
    !(await verifyProposalInviteCode(accessCode, invite.codeHash))
  ) {
    return {
      error: "No pudimos validar ese codigo. Revisa la invitacion e intentalo de nuevo."
    };
  }

  const now = new Date();
  await database.$transaction([
    database.proposalInvite.update({
      where: { id: invite.id },
      data: {
        firstViewedAt: now,
        lastViewedAt: now,
        viewCount: { increment: 1 }
      }
    }),
    database.proposal.update({
      where: { id: invite.proposalId },
      data: {
        firstViewedAt: now,
        status: "VIEWED"
      }
    }),
    database.proposalEvent.create({
      data: {
        metadata: { inviteId: invite.id },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "VIEWED"
      }
    })
  ]);

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

export async function submitProposalComment(
  token: string,
  _previousState: ProposalInteractionState,
  formData: FormData
): Promise<ProposalInteractionState> {
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
      error: "Tu sesion de propuesta ya no esta activa. Vuelve a usar el codigo."
    };
  }

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
        metadata: { source: "client" },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "COMMENTED"
      }
    })
  ]);

  return { success: "Nota enviada. JANVIER recibio tu mensaje." };
}

export async function submitProposalDecision(
  token: string,
  _previousState: ProposalInteractionState,
  formData: FormData
): Promise<ProposalInteractionState> {
  const parsed = decisionInput.safeParse({
    authorEmail: formData.get("authorEmail"),
    authorName: formData.get("authorName"),
    decision: formData.get("decision"),
    note: formData.get("note") ?? "",
    termsAccepted: formData.get("termsAccepted") === "on"
  });
  if (!parsed.success) {
    return { error: "Completa tu nombre, correo y la accion que deseas realizar." };
  }
  if (parsed.data.decision === "ACCEPT" && !parsed.data.termsAccepted) {
    return {
      error: "Confirma que aceptas los terminos de esta propuesta para continuar."
    };
  }
  if (parsed.data.decision === "REQUEST_CHANGES" && parsed.data.note.length < 8) {
    return { error: "Danos un poco mas de contexto sobre los ajustes que necesitas." };
  }

  const invite = await resolveAuthorizedInvite(token);
  if (!invite) {
    return {
      error: "Tu sesion de propuesta ya no esta activa. Vuelve a usar el codigo."
    };
  }

  const status =
    parsed.data.decision === "ACCEPT"
      ? "ACCEPTED"
      : parsed.data.decision === "DECLINE"
        ? "DECLINED"
        : "CHANGES_REQUESTED";
  const currentProposal = await database.proposal.findUnique({
    where: { id: invite.proposalId },
    select: { status: true }
  });
  if (currentProposal?.status === "ACCEPTED") {
    return {
      error: "Esta propuesta ya fue aceptada. Contacta a JANVIER para cualquier ajuste."
    };
  }

  const now = new Date();
  await database.$transaction(async (transaction) => {
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
    await transaction.proposal.update({
      where: { id: invite.proposalId },
      data: {
        acceptedAt: parsed.data.decision === "ACCEPT" ? now : null,
        status
      }
    });
    await transaction.proposalEvent.create({
      data: {
        metadata: { decision: parsed.data.decision, inviteId: invite.id },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "DECIDED"
      }
    });
  });

  return {
    success:
      parsed.data.decision === "ACCEPT"
        ? "Propuesta aceptada. JANVIER recibio tu confirmacion."
        : parsed.data.decision === "REQUEST_CHANGES"
          ? "Solicitud de ajustes enviada. Regresaremos con una nueva revision."
          : "Tu decision fue registrada. Gracias por tu tiempo."
  };
}
