import { fixupConfigRules } from "@eslint/compat";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import { defineConfig, globalIgnores } from "eslint/config";
import { turboEnv } from "./base.js";

/**
 * The Next.js app: Next's own presets (core web vitals + TypeScript), as
 * `next lint` used to set them up. Their plugins (react, jsx-a11y, import)
 * still call APIs ESLint 10 removed, so `fixupConfigRules` (ESLint's own
 * compatibility layer) wraps them. Drop the wrapper once eslint-config-next
 * supports ESLint 10 (vercel/next.js#91710).
 */
export const next = defineConfig([
  globalIgnores([
    ".next/**",
    // `NEXT_DIST_DIR=.next-build pnpm build` (CLAUDE.md §6).
    ".next-build/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  fixupConfigRules([...nextVitals, ...nextTs]),
  turboEnv(),
  prettier,
]);
