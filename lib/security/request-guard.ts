import { NextResponse } from "next/server";

type RateBucket = { count: number; resetAt: number };

const rateBuckets = new Map<string, RateBucket>();

function clientKey(request: Request, actorId: string) {
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();
  const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${actorId}:${connectingIp || forwardedIp || "local"}`;
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
    if (!value) {
      return null;
    }
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

/** A small bounded in-memory guard; a reverse proxy can add a shared limiter. */
export function assertRequestRate(
  request: Request,
  actorId: string,
  action: string,
  limit: number,
  windowMs = 60_000
) {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
  const key = `${action}:${clientKey(request, actorId)}`;
  const current = rateBuckets.get(key);
  const bucket =
    !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > limit) {
    return NextResponse.json(
      { error: "Demasiadas solicitudes. Intenta de nuevo en un minuto." },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((bucket.resetAt - now) / 1000)) }
      }
    );
  }
  return null;
}
