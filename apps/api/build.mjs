/**
 * Builds the API for `node` (see @arena/bundle):
 *
 *   node build.mjs server    src/index.ts -> dist/index.mjs, plus the
 *                            migrations it runs at startup (dist/drizzle)
 *   node build.mjs scripts   every runnable script in scripts/ ->
 *                            dist/scripts/<name>.mjs
 *
 * A runnable script is any scripts/*.ts no other script imports, so a new
 * one is picked up without listing it (crawl-seeds.ts and script-helpers.ts
 * are modules the others import). Run one with
 * `node --enable-source-maps dist/scripts/<name>.mjs [args]`.
 */
import { cp, readdir, readFile } from "node:fs/promises";
import { bundle } from "@arena/bundle";

const target = process.argv[2];

if (target === "server") {
  await bundle({
    entryPoints: ["src/index.ts"],
    outbase: "src",
    outdir: "dist",
    clean: ["dist/index.mjs", "dist/index.mjs.map", "dist/drizzle"],
  });
  // packages/db's runMigrations looks for them next to the bundle.
  await cp("../../packages/db/drizzle", "dist/drizzle", { recursive: true });
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
} else {
  console.error("usage: node build.mjs <server | scripts>");
  process.exit(1);
}
