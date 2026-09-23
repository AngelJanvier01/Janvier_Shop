const defaultSicoddBaseUrl = "https://janvier01.sicodd.com.mx";

type SicoddClientOptions = {
  baseUrl: string;
  password: string;
  username: string | null;
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

  return {
    baseUrl: baseUrl.toString().replace(/\/$/, ""),
    password,
    username: process.env.SICODD_USERNAME?.trim() || null
  };
}

function cookiePairs(headers: Headers) {
  const supportedHeaders = headers as HeadersWithSetCookies;
  const setCookies = supportedHeaders.getSetCookie?.() ?? [
    headers.get("set-cookie") ?? ""
  ];
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

function unwrapSicoddHtmlPayload(payload: string) {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (
      parsed &&
      typeof parsed === "object" &&
      "HTML" in parsed &&
      typeof parsed.HTML === "string"
    ) {
      return parsed.HTML;
    }
  } catch {
    // SICODD returns ordinary HTML for detail pages and the dashboard.
  }
  return payload;
}

export class SicoddClient {
  private cookie = "";

  constructor(private readonly options: SicoddClientOptions) {}

  private resolve(path: string) {
    return new URL(path, `${this.options.baseUrl}/`).toString();
  }

  private async request(path: string, init: RequestInit = {}, allowNotModified = false) {
    const maximumAttempts = 3;
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
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
        const retryable =
          response.status === 408 ||
          response.status === 429 ||
          response.status >= 500;
        if (retryable && attempt < maximumAttempts) {
          await response.body?.cancel();
          await new Promise((resolve) => setTimeout(resolve, attempt * 750));
          continue;
        }
        if (!response.ok && !(allowNotModified && response.status === 304)) {
          throw new Error(
            `SICODD returned ${response.status} for ${new URL(response.url).pathname}.`
          );
        }
        return response;
      } catch (error) {
        if (
          attempt === maximumAttempts ||
          (error instanceof Error && error.message.startsWith("SICODD returned "))
        ) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
    throw new Error("SICODD request exhausted its retry attempts.");
  }

  async signIn() {
    await this.request("/admin");
    const body = new URLSearchParams({
      Aceptar: "Aceptar",
      password: this.options.password
    });
    if (this.options.username) body.set("usuario", this.options.username);

    const response = await this.request(
      this.options.username ? "/admin/index/loginuser" : "/admin/index/login",
      {
        body,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        method: "POST"
      }
    );
    const html = await response.text();
    if (this.isLoginPage(html)) {
      throw new Error("SICODD rejected the configured synchronization account.");
    }
  }

  async getHtml(path: string, options?: { ifNoneMatch?: string | null }) {
    const response = await this.request(
      path,
      {
        headers: options?.ifNoneMatch ? { "if-none-match": options.ifNoneMatch } : undefined
      },
      Boolean(options?.ifNoneMatch)
    );
    const etag = response.headers.get("etag");
    const lastModified = response.headers.get("last-modified");
    if (response.status === 304) {
      return { etag, html: "", lastModified, notModified: true, url: response.url };
    }
    const html = unwrapSicoddHtmlPayload(await response.text());
    if (this.isLoginPage(html)) {
      throw new Error("SICODD session expired while mapping the catalog.");
    }
    return { etag, html, lastModified, notModified: false, url: response.url };
  }

  private isLoginPage(html: string) {
    return /Ingresar Como (?:Administrador|Usuario)/i.test(html);
  }
}

export function createSicoddClient() {
  return new SicoddClient(readSicoddConfig());
}
