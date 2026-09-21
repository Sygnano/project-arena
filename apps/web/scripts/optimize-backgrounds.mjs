// Generates the web-sized section backgrounds the summoner page actually
// loads, from the full-size source art in public/images/backgrounds/.
//
//   node scripts/optimize-backgrounds.mjs
//
// Why: every section paints its photo at `blur(16px) brightness(.42)`, so
// the multi-megabyte originals (three PNGs were 2.4–2.9 MB each, ~13 MB in
// total) looked identical to a 1280px WebP at a fraction of the size. The
// hero screens (Welcome/Farewell) use a much lighter 2px blur, so they get a
// larger output. Originals stay in place as the source of truth; rerun this
// after adding or replacing art, then point lib/section-backgrounds.ts at
// the `optimized/` file.
import { createRequire } from "node:module";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// sharp ships with Next.js; resolve it through Next rather than adding a
// direct dependency just for this build-time script.
const require = createRequire(import.meta.url);
const sharp = createRequire(require.resolve("next/package.json"))("sharp");

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourceDir = path.join(root, "public/images/backgrounds");
const outDir = path.join(sourceDir, "optimized");

/** Hero screens get more pixels because they're only lightly blurred. */
const HERO_SOURCES = new Set([
  "5eeebc2100709e8321b95ef8256ef1bbc191f3d2-2998x1686.jpg",
  "how-to-rank-fast-arena-lol-12237a09a0c7.webp",
]);

await mkdir(outDir, { recursive: true });
let before = 0;
let after = 0;
for (const file of await readdir(sourceDir)) {
  const source = path.join(sourceDir, file);
  if (!(await stat(source)).isFile()) continue;
  const width = HERO_SOURCES.has(file) ? 1920 : 1280;
  const target = path.join(outDir, `${path.parse(file).name}.webp`);
  const info = await sharp(source)
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: HERO_SOURCES.has(file) ? 78 : 70 })
    .toFile(target);
  const original = (await stat(source)).size;
  before += original;
  after += info.size;
  console.log(`${file}: ${(original / 1024).toFixed(0)} KB -> ${(info.size / 1024).toFixed(0)} KB`);
}
console.log(`total: ${(before / 1048576).toFixed(1)} MB -> ${(after / 1048576).toFixed(2)} MB`);
