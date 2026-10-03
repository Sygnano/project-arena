// Stop: when code changed, run the Turbo-cached gates (typecheck, test, Biome) and hand any
// failure back to Claude to fix. Unchanged packages hit Turbo's cache, so this is cheap.
import { execSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;

// Already continuing because of this hook: report once, never loop.
if (JSON.parse(input).stop_hook_active) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const status = execSync("git status --porcelain", { cwd: root, encoding: "utf8" });
if (!/\.(tsx?|mjs|cjs|js|json)$/m.test(status)) process.exit(0);

try {
  execSync("pnpm exec turbo run typecheck test //#biome:check --output-logs=errors-only", {
    cwd: root,
    stdio: "pipe",
    encoding: "utf8",
  });
} catch (error) {
  const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
  process.stderr.write(`typecheck/lint/test failed. Fix these before finishing:\n${output.slice(-6000)}`);
  process.exit(2);
}
