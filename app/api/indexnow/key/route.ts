const indexNowKeyPattern = /^[A-Za-z0-9-]{8,128}$/;

export function GET() {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key || !indexNowKeyPattern.test(key)) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(key, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
