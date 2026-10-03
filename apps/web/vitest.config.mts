import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit tests for pure helpers (no DOM): `@/` resolves like in tsconfig.json.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
});
