export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    status: "ok",
    service: "janvier-v2",
    timestamp: new Date().toISOString()
  });
}
