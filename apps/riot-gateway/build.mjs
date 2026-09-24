/**
 * Builds the gateway for `node` (see @arena/bundle): src/index.ts ->
 * dist/index.mjs, run with `node --enable-source-maps dist/index.mjs`.
 */
import { bundle } from "@arena/bundle";

await bundle({
  entryPoints: ["src/index.ts"],
  outbase: "src",
  outdir: "dist",
  clean: ["dist"],
});
