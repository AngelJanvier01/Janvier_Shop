import { afterEach, describe, expect, it } from "vitest";

import {
  getMercadoPagoCredentialEnvironment,
  getMercadoPagoPublicConfiguration,
  getMercadoPagoWebhookSecret
} from "../../lib/commerce/mercado-pago";

const keys = [
  "MP_CREDENTIALS_ENVIRONMENT",
  "MP_SANDBOX_PUBLIC_KEY",
  "MP_SANDBOX_ACCESS_TOKEN",
  "MP_SANDBOX_WEBHOOK_SECRET",
  "MP_PRODUCTION_PUBLIC_KEY",
  "MP_PRODUCTION_ACCESS_TOKEN",
  "MP_PRODUCTION_WEBHOOK_SECRET"
] as const;

afterEach(() => {
  for (const key of keys) delete process.env[key];
});

describe("Mercado Pago credential isolation", () => {
  it("selects only the complete sandbox set", () => {
    process.env.MP_CREDENTIALS_ENVIRONMENT = "sandbox";
    process.env.MP_SANDBOX_PUBLIC_KEY = "sandbox-public";
    process.env.MP_SANDBOX_ACCESS_TOKEN = "sandbox-access";
    process.env.MP_SANDBOX_WEBHOOK_SECRET = "sandbox-webhook";

    expect(getMercadoPagoCredentialEnvironment()).toBe("sandbox");
    expect(getMercadoPagoWebhookSecret()).toBe("sandbox-webhook");
    expect(getMercadoPagoPublicConfiguration()).toMatchObject({
      environment: "sandbox",
      publicKey: "sandbox-public",
      ready: true
    });
  });

  it("fails closed when sandbox and production credentials coexist", () => {
    process.env.MP_CREDENTIALS_ENVIRONMENT = "sandbox";
    process.env.MP_SANDBOX_PUBLIC_KEY = "sandbox-public";
    process.env.MP_SANDBOX_ACCESS_TOKEN = "sandbox-access";
    process.env.MP_SANDBOX_WEBHOOK_SECRET = "sandbox-webhook";
    process.env.MP_PRODUCTION_ACCESS_TOKEN = "production-access";

    expect(getMercadoPagoPublicConfiguration().ready).toBe(false);
    expect(getMercadoPagoWebhookSecret()).toBeNull();
    expect(() => getMercadoPagoCredentialEnvironment()).toThrow(/no pueden coexistir/u);
  });
});
