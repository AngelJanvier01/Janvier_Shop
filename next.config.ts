import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
// Checkout Bricks keeps card data inside Mercado Pago secure fields. These are
// the narrowly scoped production origins used by the official JavaScript SDK;
// do not replace them with a broad `*.mercadopago.com` allowlist.
const mercadoPagoSources = {
  api: "https://api.mercadopago.com",
  assets: "https://http2.mlstatic.com",
  sdk: "https://sdk.mercadopago.com",
  secureFields: "https://secure-fields.mercadopago.com"
};
const googleScriptSource = " https://www.googletagmanager.com";
const googleConnectSources =
  " https://www.google-analytics.com https://region1.google-analytics.com https://www.googletagmanager.com";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${mercadoPagoSources.sdk} ${mercadoPagoSources.assets}${googleScriptSource}${isProduction ? "" : " 'unsafe-eval'"}`,
  "script-src-attr 'none'",
  `style-src 'self' 'unsafe-inline' ${mercadoPagoSources.assets}`,
  `img-src 'self' data: blob: https://janvier01.sicodd.com.mx ${mercadoPagoSources.assets} https://www.google-analytics.com https://www.googletagmanager.com`,
  `font-src 'self' data: ${mercadoPagoSources.assets}`,
  `connect-src 'self' ${mercadoPagoSources.api}${googleConnectSources}${isProduction ? "" : " ws:"}`,
  `frame-src 'self' ${mercadoPagoSources.secureFields}`,
  "media-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  isProduction ? "upgrade-insecure-requests" : ""
]
  .filter(Boolean)
  .join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()"
  },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : [])
];

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  allowedDevOrigins: ["localhost", "127.0.0.1", "[::1]"],
  poweredByHeader: false,
  async headers() {
    const privatePageHeaders = [
      {
        key: "Cache-Control",
        value: "private, no-store, no-cache, max-age=0, must-revalidate"
      },
      { key: "Pragma", value: "no-cache" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }
    ];
    return [
      {
        headers: securityHeaders,
        source: "/:path*"
      },
      {
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
        source: "/ascii/:path*.json"
      },
      {
        headers: privatePageHeaders,
        source: "/propuesta/:path*"
      },
      {
        headers: privatePageHeaders,
        source: "/admin/propuestas/:path*/preview"
      },
      {
        headers: privatePageHeaders,
        source: "/admin/:path*"
      },
      {
        headers: privatePageHeaders,
        source: "/suministro/:path(acceso|carrito|mi-cuenta|pagos|registro)/:rest*"
      },
      {
        headers: privatePageHeaders,
        source: "/api/:path*"
      }
    ];
  }
};

export default nextConfig;
