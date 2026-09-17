import { afterEach, describe, expect, it, vi } from "vitest";

import { SicoddClient } from "@/lib/sicodd/client";

const supplierOrigin = "https://janvier01.sicodd.com.mx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SICODD client authentication", () => {
  it("uses the user login endpoint when a provider username is configured", async () => {
    const requests: Array<{ body: string; url: string }> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        requests.push({ body: String(init?.body ?? ""), url: String(input) });
        return new Response("<main>CONTROL ROOM</main>", { status: 200 });
      })
    );
    const client = new SicoddClient({
      baseUrl: supplierOrigin,
      password: "test-password",
      username: "sync-user"
    });

    await client.signIn();

    expect(requests.map((request) => request.url)).toEqual([
      `${supplierOrigin}/admin`,
      `${supplierOrigin}/admin/index/loginuser`
    ]);
    expect(requests[1]?.body).toContain("usuario=sync-user");
    expect(requests[1]?.body).toContain("password=test-password");
  });

  it("keeps compatibility with a password-only administrator login", async () => {
    const requests: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        requests.push(String(input));
        return new Response("<main>CONTROL ROOM</main>", { status: 200 });
      })
    );
    const client = new SicoddClient({
      baseUrl: supplierOrigin,
      password: "test-password",
      username: null
    });

    await client.signIn();

    expect(requests.at(-1)).toBe(`${supplierOrigin}/admin/index/login`);
  });

  it("unwraps the HTML fragment returned by SICODD catalog filters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ HTML: "<article>PRODUCTO</article>", PAGINATION: "" }),
            {
              status: 200
            }
          )
      )
    );
    const client = new SicoddClient({
      baseUrl: supplierOrigin,
      password: "test-password",
      username: null
    });

    await expect(client.getHtml("/admin/producto?clave=GBGC")).resolves.toMatchObject({
      html: "<article>PRODUCTO</article>"
    });
  });
});
