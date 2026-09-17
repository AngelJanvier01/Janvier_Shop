import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("Docker build context secret exclusions", () => {
  it("excludes real env files while retaining committed examples", async () => {
    const source = await readFile(resolve(process.cwd(), ".dockerignore"), "utf8");
    expect(source).toContain(".env*");
    expect(source).toContain("!.env.example");
    expect(source).toContain("!.env.production.example");
  });
});
