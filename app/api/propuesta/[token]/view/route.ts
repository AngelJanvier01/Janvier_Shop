import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";

import { database } from "@/lib/database";
import {
  proposalAccessCookieName,
  readProposalAccessCookieIdentity,
  verifyProposalAccessCookie
} from "@/lib/proposals/invite-access";
import { hashInviteToken } from "@/lib/proposals/invite-security";
import {
  canReadProjectRoom,
  proposalStatus,
  shouldRecordProposalView,
  transitionProposal
} from "@/lib/proposals/proposal-state";

type ProposalViewRouteContext = {
  params: Promise<{ token: string }>;
};

function requestMetadata(headerValues: Headers) {
  const forwarded = headerValues.get("x-forwarded-for");
  return {
    ip: forwarded?.split(",")[0]?.trim() || headerValues.get("x-real-ip") || null,
    userAgent: headerValues.get("user-agent")?.slice(0, 1000) || null
  };
}

/** Records one actual Project Room opening after the document mounts in the browser. */
export async function POST(_request: Request, context: ProposalViewRouteContext) {
  const { token } = await context.params;
  const cookieStore = await cookies();
  const accessCookie = cookieStore.get(proposalAccessCookieName(token))?.value;
  const identity = readProposalAccessCookieIdentity(accessCookie);
  if (!identity || !verifyProposalAccessCookie(token, accessCookie)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const metadata = requestMetadata(await headers());
  const recorded = await database.$transaction(async (transaction) => {
    const invite = await transaction.proposalInvite.findUnique({
      where: { tokenHash: hashInviteToken(token) },
      include: {
        proposal: { select: { firstViewedAt: true, status: true } },
        revision: { select: { sharedAt: true } },
        viewers: {
          select: { firstViewedAt: true, id: true, name: true },
          where: { id: identity.viewerId }
        }
      }
    });
    const viewer = invite?.viewers[0];
    if (
      !invite ||
      !viewer ||
      invite.status !== "ACTIVE" ||
      invite.expiresAt.getTime() <= Date.now() ||
      !canReadProjectRoom(invite.proposal.status, Boolean(invite.revision.sharedAt))
    ) {
      return false;
    }

    const now = new Date();
    const [view] = await Promise.all([
      transaction.proposalInviteView.create({
        data: {
          inviteId: invite.id,
          ip: metadata.ip,
          userAgent: metadata.userAgent,
          viewerId: viewer.id
        },
        select: { id: true }
      }),
      transaction.proposalInviteViewer.update({
        data: {
          firstViewedAt: viewer.firstViewedAt ?? now,
          lastViewedAt: now,
          viewCount: { increment: 1 }
        },
        where: { id: viewer.id }
      }),
      transaction.proposalInvite.update({
        data: {
          firstViewedAt: invite.firstViewedAt ?? now,
          lastViewedAt: now,
          viewCount: { increment: 1 }
        },
        where: { id: invite.id }
      })
    ]);
    if (shouldRecordProposalView(invite.proposal.status)) {
      await transaction.proposal.update({
        data: {
          ...transitionProposal(invite.proposal.status, proposalStatus.VIEWED),
          firstViewedAt: invite.proposal.firstViewedAt ?? now
        },
        where: { id: invite.proposalId }
      });
    }
    await transaction.proposalEvent.create({
      data: {
        metadata: {
          inviteId: invite.id,
          viewerId: viewer.id,
          viewerName: viewer.name,
          viewId: view.id,
          ...metadata
        },
        proposalId: invite.proposalId,
        revisionId: invite.revisionId,
        type: "INVITE_VIEWED"
      }
    });
    return true;
  });

  return NextResponse.json(
    { ok: recorded },
    {
      headers: {
        "Cache-Control": "no-store",
        Vary: "Cookie"
      },
      status: recorded ? 200 : 403
    }
  );
}
