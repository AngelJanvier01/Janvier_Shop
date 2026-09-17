const defaultSicoddBaseUrl = "https://janvier01.sicodd.com.mx";

type SicoddClientOptions = {
  baseUrl: string;
  password: string;
};

type HeadersWithSetCookies = Headers & {
  getSetCookie?: () => string[];
};

function readSicoddConfig(): SicoddClientOptions {
  const password = process.env.SICODD_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("SICODD_ADMIN_PASSWORD is required for SICODD synchronization.");
  }

  const configuredUrl = process.env.SICODD_BASE_URL?.trim() || defaultSicoddBaseUrl;
  let baseUrl: URL;
  try {
    baseUrl = new URL(configuredUrl);
  } catch {
    throw new Error("SICODD_BASE_URL must be an absolute URL.");
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error("SICODD_BASE_URL must use HTTPS.");
  }

  return { baseUrl: baseUrl.toString().replace(/\/$/, ""), password };
}

function cookiePairs(headers: Headers) {
  const supportedHeaders = headers as HeadersWithSetCookies;
  const setCookies = supportedHeaders.getSetCookie?.() ?? [headers.get("set-cookie") ?? ""];
  return setCookies
    .map((entry) => entry.split(";", 1)[0]?.trim())
    .filter((entry): entry is string => Boolean(entry && entry.includes("=")));
}

function mergeCookies(current: string, response: Response) {
  const values = new Map<string, string>();
  for (const entry of current.split(";")) {
    const [name, ...rest] = entry.trim().split("=");
    if (name && rest.length) {
      values.set(name, `${name}=${rest.join("=")}`);
    }
  }
  for (const entry of cookiePairs(response.headers)) {
    const [name] = entry.split("=", 1);
    if (name) {
      values.set(name, entry);
    }
  }
  return [...values.values()].join("; ");
}

export class SicoddClient {
  private cookie = "";

  constructor(private readonly options: SicoddClientOptions) {}

  private resolve(path: string) {
    return new URL(path, `${this.options.baseUrl}/`).toString();
  }

  private async request(path: string, init: RequestInit = {}) {
    const response = await fetch(this.resolve(path), {
      ...init,
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...init.headers
      },
      redirect: "follow",
      signal: AbortSignal.timeout(25_000)
    });
    this.cookie = mergeCookies(this.cookie, response);
    if (!response.ok) {
      throw new Error(`SICODD returned ${response.status} for ${new URL(response.url).pathname}.`);
    }
    return response;
  }

  async signIn() {
    await this.request("/admin");
    const body = new URLSearchParams({ Aceptar: "Aceptar", password: this.options.password });
    const response = await this.request("/admin/index/login", {
      body,
      headers: { "content-type": "application/x-www-form-urlencoded" },
      method: "POST"
    });
    const html = await response.text();
    if (/Ingresar Como Administrador/i.test(html)) {
      throw new Error("SICODD rejected the configured synchronization account.");
    }
  }

  async getHtml(path: string) {
    const response = await this.request(path);
    const html = await response.text();
    if (/Ingresar Como Administrador/i.test(html)) {
      throw new Error("SICODD session expired while mapping the catalog.");
    }
    return { html, url: response.url };
  }
}

export function createSicoddClient() {
  return new SicoddClient(readSicoddConfig());
}
