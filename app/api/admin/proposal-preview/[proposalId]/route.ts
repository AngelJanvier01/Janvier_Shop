import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import {
  assertRequestRate,
  assertSameOriginMutation
} from "@/lib/security/request-guard";

const eventSchema = z
  .object({
    event: z.enum([
      "PROPOSAL_PREVIEW_OPENED",
      "PROPOSAL_PREVIEW_THEME_CHANGED",
      "PROPOSAL_PREVIEW_DEVICE_CHANGED",
      "PROPOSAL_PREVIEW_VALIDATED",
      "PROPOSAL_PRESENTATION_MODE_OPENED"
    ]),
    revisionId: z.string().cuid()
  })
  .strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ proposalId: string }> }
) {
  const admin = await getCurrentAdmin();
  if (!admin) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const originError = assertSameOriginMutation(request);
  if (originError) {
    return originError;
  }
  const rateError = assertRequestRate(request, admin.id, "proposal-preview-audit", 60);
  if (rateError) {
    return rateError;
  }
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Evento de preview inválido." }, { status: 400 });
  }
  const { proposalId } = await context.params;
  const revision = await database.proposalRevision.findFirst({
    select: { id: true },
    where: { id: parsed.data.revisionId, proposalId }
  });
  if (!revision) {
    return NextResponse.json({ error: "Revisión no encontrada." }, { status: 404 });
  }
  await database.proposalEvent.create({
    data: {
      adminActorId: admin.id,
      proposalId,
      revisionId: revision.id,
      type: parsed.data.event
    }
  });
  return new Response(null, { status: 204 });
}
