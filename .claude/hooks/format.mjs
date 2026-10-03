// PostToolUse (Edit|Write): run Biome on the file Claude just wrote (format, sort imports, safe
// lint fixes), so formatting never drifts. Files biome.jsonc ignores (generated, vendored) and
// file types Biome doesn't handle (Markdown) are left alone.
import { execFileSync } from "node:child_process";
import path from "node:path";

let input = "";
for await (const chunk of process.stdin) input += chunk;

const file = JSON.parse(input).tool_input?.file_path;
if (file) {
  const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const biome = path.join(root, "node_modules", "@biomejs", "biome", "bin", "biome");
  try {
    execFileSync(
      process.execPath,
      [biome, "check", "--write", "--files-ignore-unknown=true", "--no-errors-on-unmatched", file],
      { cwd: root, stdio: "ignore" },
    );
  } catch {
    // A syntax error or a lint error mid-edit: the Stop hook reports it.
  }
}
