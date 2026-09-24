import { promisify } from "node:util";
import { brotliCompress, brotliDecompressSync, constants } from "node:zlib";

const brotliCompressAsync = promisify(brotliCompress);

/**
 * Brotli quality for compressing stored match/timeline JSON. Measured on
 * real Arena payloads: quality 9 gets ~13-22x compression (vs Postgres's
 * own automatic TOAST/pglz compression, which only manages ~2-5x on the
 * same data) in about 25 ms for a 1.5 MB timeline. Quality 11 (the zlib
 * default) shaves off another ~20-25% but takes ~1.5 seconds on a large
 * timeline — not worth it for a one-time ingestion-time cost. See CLAUDE.md
 * for the full measurements this was chosen from.
 */
const BROTLI_QUALITY = 9;

/** Async: the compression runs on libuv's thread pool, not the API's one
 * JavaScript thread (only the `JSON.stringify` stays on it). */
export function compressJson(value: unknown): Promise<Buffer> {
  return brotliCompressAsync(JSON.stringify(value), {
    params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
  });
}

export function decompressJson<T = unknown>(data: Buffer): T {
  return JSON.parse(brotliDecompressSync(data).toString("utf-8")) as T;
}
