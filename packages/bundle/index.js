import { rm } from "node:fs/promises";
import * as esbuild from "esbuild";

/**
 * Left out of every bundle, loaded from node_modules at runtime. pino starts
 * its transports (pino-pretty, in a terminal) in a worker thread that loads
 * its files by path, which a bundle doesn't keep.
 */
const EXTERNAL = ["pino", "pino-pretty"];

/**
 * Bundles a Node service or script into plain JavaScript that `node` runs
 * as is: workspace packages (TypeScript source) and npm dependencies are
 * compiled in, minified, with a source map for `node --enable-source-maps`.
 * Each entry becomes `<outdir>/<path under outbase>.mjs`, self-contained.
 * `clean` lists the paths under the package this build owns, removed first.
 */
export async function bundle({ entryPoints, outdir, outbase, clean = [] }) {
  for (const path of clean) await rm(path, { recursive: true, force: true });
  const startedAt = performance.now();
  await esbuild.build({
    entryPoints,
    outdir,
    outbase,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    // The oldest Node the repo supports (engines.node).
    target: "node22",
    minify: true,
    sourcemap: true,
    external: EXTERNAL,
    // CommonJS dependencies (fastify, ...) call require(), which ESM output lacks.
    banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
    logLevel: "warning",
  });
  console.log(
    `bundled ${entryPoints.length} entr${entryPoints.length === 1 ? "y" : "ies"} into ${outdir}/ in ${Math.round(performance.now() - startedAt)}ms`,
  );
}
