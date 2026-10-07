/**
 * Runs one of apps/api's scripts from the repository root, with apps/api's .env, passing the
 * remaining arguments through:
 *
 *   pnpm script:api crawl --forever
 *   pnpm script:api retry-skipped
 *
 * The name may omit `.ts` and `scripts/`. Without one, lists the runnable scripts. A runnable
 * script is any apps/api/scripts/*.ts no other script imports (the same rule as apps/api's build).
 */
import { spawn } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = fileURLToPath(new URL("../apps/api/", import.meta.url));
const scriptsDir = path.join(apiDir, "scripts");

const files = readdirSync(scriptsDir).filter((file) => file.endsWith(".ts"));
const imported = new Set();
for (const file of files) {
  const source = readFileSync(path.join(scriptsDir, file), "utf8");
  for (const [, name] of source.matchAll(/from\s+["']\.\/([\w-]+)\.js["']/g)) imported.add(`${name}.ts`);
}
const runnable = files.filter((file) => !imported.has(file)).map((file) => file.replace(/\.ts$/, ""));

const [requested, ...args] = process.argv.slice(2);
const name = requested?.replace(/^scripts[\\/]/, "").replace(/\.ts$/, "");
if (!name || !runnable.includes(name)) {
  if (name) console.error(`No runnable script "${name}" in apps/api/scripts.`);
  console.error(`Usage: pnpm script:api <name> [args]\nScripts: ${runnable.join(", ")}`);
  process.exit(name ? 1 : 0);
}

// tsx from apps/api's own dependencies, run by this same node: no shell, so arguments pass as is.
const tsxCli = createRequire(path.join(apiDir, "package.json")).resolve("tsx/cli");
const child = spawn(process.execPath, [tsxCli, "--env-file-if-exists=.env", `scripts/${name}.ts`, ...args], {
  cwd: apiDir,
  stdio: "inherit",
});
// Ctrl+C reaches the child through the shared console; this process waits for it to finish.
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
