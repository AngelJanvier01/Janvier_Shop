import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  response.headers.set(
    "Cache-Control",
    "private, no-store, no-cache, max-age=0, must-revalidate"
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export const config = {
  matcher: ["/propuesta/:path*"]
};
