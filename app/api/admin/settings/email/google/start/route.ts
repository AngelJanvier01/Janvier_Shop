import { NextResponse } from "next/server";

import { AdminAuditEventType } from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { googleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";
import {
  createGoogleOAuthAttempt,
  safeEmailSettingsReturnPath
} from "@/lib/settings/google-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { admin, sessionIdHash } = await requireSettingsAdmin();
  const returnPath = safeEmailSettingsReturnPath(
    new URL(request.url).searchParams.get("return")
  );
  const state = await createGoogleOAuthAttempt({
    adminId: admin.id,
    returnPath,
    sessionIdHash
  });
  await database.adminAuditEvent.create({
    data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECT_STARTED, userId: admin.id }
  });
  const response = NextResponse.redirect(
    googleOAuthAdapter.buildAuthorizationUrl({ promptConsent: true, state })
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
