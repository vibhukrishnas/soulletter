import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    testTimeout: 30_000,
    // Calculations must be deterministic; keep the time zone fixed so local-time
    // helpers in tests cannot depend on the developer's machine settings.
    env: { TZ: "UTC" },
  },
});
