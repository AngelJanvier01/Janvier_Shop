import { database } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await database.$queryRaw`SELECT 1`;
    return Response.json({
      status: "ok",
      service: "janvier-v2",
      timestamp: new Date().toISOString()
    });
  } catch {
    return Response.json(
      { status: "unavailable", service: "janvier-v2" },
      { status: 503 }
    );
  }
}
