import { describe, expect, it } from "vitest";

import { GET } from "../../app/api/health/route";

describe("GET /api/health", () => {
  it("returns the V2 service status", async () => {
    const response = GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      status: "ok",
      service: "janvier-v2"
    });
    expect(typeof payload.timestamp).toBe("string");
  });
});
