import { defineConfig, globalIgnores } from "eslint/config";
import nextTypeScript from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "app/generated/**",
    "backend/**",
    "scripts/**",
    "styles/admin.css",
    "styles/styles.css",
    "vitest.config.ts",
    "playwright.config.ts",
    "next.config.ts",
    "prisma.config.ts"
  ])
]);
