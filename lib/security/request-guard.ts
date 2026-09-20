import { createHash } from "node:crypto";
import { isIP } from "node:net";

import { NextResponse } from "next/server";

import { database } from "@/lib/database";

type RateBucket = { attempts: number; windowStart: Date };

function trustedProxyClientIpEnabled() {
  return process.env.TRUST_PROXY_CLIENT_IP === "true";
}

function safeIp(value: string | null | undefined) {
  const candidate = value?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

/**
 * Proxies must remove client-supplied forwarding headers before this is
 * enabled. When the deployment has not explicitly opted in, headers are not
 * trusted and the actor identifier still provides a safe durable limit.
 */
export function requestClientIdentity(headers: Headers) {
  if (!trustedProxyClientIpEnabled()) return "proxy-untrusted";
  return (
    safeIp(headers.get("cf-connecting-ip")) ??
    safeIp(headers.get("x-forwarded-for")?.split(",")[0]) ??
    "proxy-ip-missing"
  );
}

export function requestRateKey(action: string, actorId: string, headers: Headers) {
  return createHash("sha256")
    .update(`${action}\u0000${actorId}\u0000${requestClientIdentity(headers)}`)
    .digest("hex");
}

async function consumeRateBucket(keyHash: string, windowMs: number) {
  const [bucket] = await database.$queryRaw<RateBucket[]>`
    INSERT INTO "RequestRateLimit" ("keyHash", "windowStart", "attempts", "updatedAt")
    VALUES (${keyHash}, NOW(), 1, NOW())
    ON CONFLICT ("keyHash") DO UPDATE
    SET
      "attempts" = CASE
        WHEN "RequestRateLimit"."windowStart" <= NOW() - (${windowMs} * INTERVAL '1 millisecond')
          THEN 1
        ELSE "RequestRateLimit"."attempts" + 1
      END,
      "windowStart" = CASE
        WHEN "RequestRateLimit"."windowStart" <= NOW() - (${windowMs} * INTERVAL '1 millisecond')
          THEN NOW()
        ELSE "RequestRateLimit"."windowStart"
      END,
      "updatedAt" = NOW()
    RETURNING "attempts", "windowStart";
  `;
  return bucket;
}

async function rateLimitResponse(
  headers: Headers,
  actorId: string,
  action: string,
  limit: number,
  windowMs: number
) {
  try {
    const bucket = await consumeRateBucket(requestRateKey(action, actorId, headers), windowMs);
    if (!bucket || bucket.attempts <= limit) return null;
    const retryAfter = Math.max(
      1,
      Math.ceil((bucket.windowStart.getTime() + windowMs - Date.now()) / 1000)
    );
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en unos minutos." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  } catch (error) {
    console.error("JANVIER durable rate limit failed", { action, error });
    return NextResponse.json(
      { error: "El control de seguridad no está disponible. Intenta de nuevo más tarde." },
      { status: 503 }
    );
  }
}

/**
 * Same-origin check for browser mutations. Server Actions have their own
 * protection; JSON/multipart endpoints must enforce it themselves.
 */
export function assertSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site");
  const allowedOrigins = new Set([new URL(request.url).origin]);
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (configuredSiteUrl) {
    try {
      allowedOrigins.add(new URL(configuredSiteUrl).origin);
    } catch {
      // Startup validation owns malformed deployment configuration.
    }
  }
  function parseSource(value: string | null) {
    if (!value) return null;
    try {
      return new URL(value);
    } catch {
      return "INVALID" as const;
    }
  }
  const parsedOrigin = parseSource(origin);
  const parsedReferer = parseSource(referer);
  if (parsedOrigin === "INVALID" || parsedReferer === "INVALID") {
    return NextResponse.json(
      { error: "Origen de solicitud no permitido." },
      { status: 403 }
    );
  }
  const localDevelopmentOrigin = Boolean(
    parsedOrigin &&
      process.env.NODE_ENV !== "production" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsedOrigin.hostname) &&
      parsedOrigin.protocol === "http:"
  );
  const trustedOrigin = Boolean(
    parsedOrigin && (allowedOrigins.has(parsedOrigin.origin) || localDevelopmentOrigin)
  );
  const trustedReferer = Boolean(
    parsedReferer && allowedOrigins.has(parsedReferer.origin)
  );
  if (fetchSite === "cross-site" && !trustedOrigin && !trustedReferer) {
    return NextResponse.json(
      { error: "Origen de solicitud no permitido." },
      { status: 403 }
    );
  }
  if (origin && !trustedOrigin && !trustedReferer) {
    return NextResponse.json(
      { error: "Origen de solicitud no permitido." },
      { status: 403 }
    );
  }
  return null;
}

export async function assertRequestRate(
  request: Request,
  actorId: string,
  action: string,
  limit: number,
  windowMs = 60_000
) {
  return rateLimitResponse(request.headers, actorId, action, limit, windowMs);
}

/** Server Actions use their request headers and the same durable limiter. */
export async function isHeaderRateLimited(
  requestHeaders: Headers,
  actorId: string,
  action: string,
  limit: number,
  windowMs = 60_000
) {
  const result = await rateLimitResponse(requestHeaders, actorId, action, limit, windowMs);
  return Boolean(result);
}
