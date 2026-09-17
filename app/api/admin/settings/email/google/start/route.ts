import { NextResponse } from "next/server";

import { AdminAuditEventType } from "@/app/generated/prisma/client";
import { requireSettingsAdmin } from "@/lib/auth/current-admin";
import { database } from "@/lib/database";
import { googleOAuthAdapter } from "@/lib/settings/google-oauth-adapter";
import { getGoogleOAuthBootstrap } from "@/lib/settings/google-oauth-config";
import {
  createGoogleOAuthAttempt,
  safeEmailSettingsReturnPath
} from "@/lib/settings/google-oauth-state";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { admin, sessionIdHash } = await requireSettingsAdmin();
  if (!getGoogleOAuthBootstrap().configured) {
    const url = new URL("/admin/ajustes/correo", request.url);
    url.searchParams.set("google", "bootstrap-invalid");
    const response = NextResponse.redirect(url);
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const returnPath = safeEmailSettingsReturnPath(
    new URL(request.url).searchParams.get("return")
  );
  const attempt = await createGoogleOAuthAttempt({
    adminId: admin.id,
    returnPath,
    sessionIdHash
  });
  await database.adminAuditEvent.create({
    data: { type: AdminAuditEventType.GOOGLE_OAUTH_CONNECT_STARTED, userId: admin.id }
  });
  const response = NextResponse.redirect(
    googleOAuthAdapter.buildAuthorizationUrl({
      nonce: attempt.nonce,
      promptConsent: true,
      state: attempt.state
    })
  );
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
