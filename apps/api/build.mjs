/**
 * Builds the API for `node` (see @arena/bundle):
 *
 *   node build.mjs server    src/index.ts -> dist/index.mjs, plus the
 *                            migrations it runs at startup (dist/drizzle)
 *   node build.mjs scripts   every runnable script in scripts/ ->
 *                            dist/scripts/<name>.mjs, plus the migrations
 *                            (dist/drizzle) for scripts/migrate.ts, the
 *                            Railway pre-deploy command
 *
 * A runnable script is any scripts/*.ts no other script imports, so a new
 * one is picked up without listing it (crawl-seeds.ts and script-helpers.ts
 * are modules the others import). Run one with
 * `node --enable-source-maps dist/scripts/<name>.mjs [args]`.
 */
import { cp, readdir, readFile, rm } from "node:fs/promises";
import { bundle } from "@arena/bundle";

const target = process.argv[2];

// packages/db's runMigrations looks for them in dist/drizzle, next to the
// server bundle and one level up from the scripts' (dist/scripts/*.mjs).
async function copyMigrations() {
  await rm("dist/drizzle", { recursive: true, force: true });
  await cp("../../packages/db/drizzle", "dist/drizzle", { recursive: true });
}

if (target === "server") {
  await bundle({
    entryPoints: ["src/index.ts"],
    outbase: "src",
    outdir: "dist",
    clean: ["dist/index.mjs", "dist/index.mjs.map"],
  });
  await copyMigrations();
} else if (target === "scripts") {
  const files = (await readdir("scripts")).filter((file) => file.endsWith(".ts"));
  const imported = new Set();
  for (const file of files) {
    const source = await readFile(`scripts/${file}`, "utf8");
    for (const [, name] of source.matchAll(/from\s+["']\.\/([\w-]+)\.js["']/g)) imported.add(`${name}.ts`);
  }
  await bundle({
    entryPoints: files.filter((file) => !imported.has(file)).map((file) => `scripts/${file}`),
    outbase: ".",
    outdir: "dist",
    clean: ["dist/scripts"],
  });
  await copyMigrations();
} else {
  console.error("usage: node build.mjs <server | scripts>");
  process.exit(1);
}
