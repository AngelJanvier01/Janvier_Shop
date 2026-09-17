import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url))
    }
  },
  test: {
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://janvier:janvier@127.0.0.1:5432/janvier_test?schema=public"
    },
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    passWithNoTests: false
  }
});
