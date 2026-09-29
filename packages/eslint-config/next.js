import { readdirSync } from "node:fs";
import path from "node:path";
import { fixupConfigRules } from "@eslint/compat";
import nextTs from "eslint-config-next/typescript";
import nextVitals from "eslint-config-next/core-web-vitals";
import prettier from "eslint-config-prettier/flat";
import checkFile from "eslint-plugin-check-file";
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

// Relative imports only reach into the importer's own folder; anything else
// goes through `@/`, so the boundary rules below see every cross-folder import.
const PARENT_IMPORT = {
  regex: "^\\.\\./",
  message: "Import through `@/` instead of `../` (relative imports only reach into this file's own folder).",
};

/**
 * Bulletproof React's architecture rules for apps/web
 * (github.com/alan2207/bulletproof-react, its Next.js app's ESLint config):
 *
 * - Unidirectional imports: shared code (`components`, `hooks`, `lib`,
 *   `utils`) → `features/<name>` → `app`. Shared code imports neither
 *   features nor app; a feature imports no other feature and not the app;
 *   features are composed in `app/`. One block per folder in `src/features`,
 *   read when the config loads, so a new feature is covered without touching
 *   this file. No `../` imports and no import cycles.
 * - Naming: every `.ts`/`.tsx` file and every folder in kebab-case (the
 *   component inside keeps its PascalCase name). `src/app` folders follow
 *   Next's route rules instead (`[riotId]`, `_components`, `(group)`),
 *   still kebab-case otherwise.
 *
 * Pass the app's directory.
 */
export function architecture(appDir) {
  const src = path.join(appDir, "src");
  const features = readdirSync(path.join(src, "features"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  const noApp = {
    group: ["@/app", "@/app/**"],
    message: "Only `app/` composes routes; import from features or shared code.",
  };
  return defineConfig([
    {
      files: ["src/**/*.{ts,tsx}"],
      plugins: { "check-file": checkFile },
      rules: {
        "no-restricted-imports": ["error", { patterns: [PARENT_IMPORT] }],
        "import/no-cycle": "error",
        "check-file/filename-naming-convention": [
          "error",
          { "src/**/*.{ts,tsx}": "KEBAB_CASE" },
          // `next-env.d.ts`-style names: only the part before the first dot counts.
          { ignoreMiddleExtensions: true },
        ],
        "check-file/folder-naming-convention": [
          "error",
          {
            "src/!(app)/**/": "KEBAB_CASE",
            "src/app/**/": "NEXT_JS_APP_ROUTER_CASE",
          },
        ],
      },
    },
    {
      files: ["src/{components,hooks,lib,utils}/**/*.{ts,tsx}"],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              PARENT_IMPORT,
              noApp,
              { group: ["@/features", "@/features/**"], message: "Shared code can't depend on a feature." },
            ],
          },
        ],
      },
    },
    ...features.map((feature) => ({
      files: [`src/features/${feature}/**/*.{ts,tsx}`],
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              PARENT_IMPORT,
              noApp,
              {
                group: ["@/features/**", `!@/features/${feature}`, `!@/features/${feature}/**`],
                message: "A feature can't import another feature; compose them in `app/`.",
              },
            ],
          },
        ],
      },
    })),
  ]);
}
