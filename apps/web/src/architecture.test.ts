import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// The parts of Bulletproof React's rules (apps/web/CLAUDE.md) that the root biome.jsonc can't
// express: Biome names files but not folders, and its config can't list `src/features` itself.

const src = import.meta.dirname;
const KEBAB = "[a-z0-9]+(?:-[a-z0-9]+)*";
// Next's App Router segments: `[riotId]`, `[...slug]`, `[[...slug]]`, `(group)`, `_private`, `@slot`.
const APP_SEGMENT = new RegExp(
  `^(?:_?${KEBAB}|\\(${KEBAB}\\)|@${KEBAB}|\\[{1,2}(?:\\.{3})?[a-z][a-zA-Z0-9]*\\]{1,2})$`,
);
const KEBAB_SEGMENT = new RegExp(`^${KEBAB}$`);

function folders(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return [full, ...folders(full)];
    });
}

describe("apps/web architecture", () => {
  it("names every folder in kebab-case, and src/app folders by Next's route rules", () => {
    const offenders = folders(src)
      .map((full) => path.relative(src, full).split(path.sep))
      .filter((segments) => segments[0] !== "vendor")
      .filter((segments) => !(segments[0] === "app" ? APP_SEGMENT : KEBAB_SEGMENT).test(segments.at(-1)!))
      .map((segments) => segments.join("/"));
    expect(offenders).toEqual([]);
  });

  it("gives every feature its own import-boundary block in biome.jsonc", () => {
    const biome = readFileSync(path.join(src, "..", "..", "..", "biome.jsonc"), "utf8");
    const missing = readdirSync(path.join(src, "features"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((feature) => !biome.includes(`"!@/features/${feature}/**"`));
    expect(missing).toEqual([]);
  });
});
