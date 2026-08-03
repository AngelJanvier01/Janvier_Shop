import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("../../lib/database", () => ({
  database: { $queryRaw: queryRaw }
}));

import { GET } from "../../app/api/health/route";

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("returns the V2 service status", async () => {
    queryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "ok",
      service: "janvier-v2"
    });
    expect(typeof payload.timestamp).toBe("string");
  });

  it("reports unavailable when PostgreSQL cannot respond", async () => {
    queryRaw.mockRejectedValueOnce(new Error("database unavailable"));
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ status: "unavailable" });
  });
});
