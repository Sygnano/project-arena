import js from "@eslint/js";
import prettier from "eslint-config-prettier/flat";
import turbo from "eslint-plugin-turbo";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * TypeScript on Node (the API, the gateway, the shared packages): ESLint's
 * and typescript-eslint's recommended rule sets.
 */
export const base = defineConfig([
  globalIgnores(["dist/**", ".turbo/**"]),
  js.configs.recommended,
  tseslint.configs.recommended,
  { languageOptions: { globals: globals.node } },
  turboEnv(),
  // Last: turns off every rule Prettier's formatting would fight with.
  prettier,
]);

/**
 * Flags an environment variable read in code that turbo.json doesn't
 * declare: Turborepo leaves undeclared variables out of a task's cache key,
 * so a cached result could come from a run with a different value.
 */
export function turboEnv() {
  return {
    plugins: { turbo },
    rules: { "turbo/no-undeclared-env-vars": "warn" },
  };
}
