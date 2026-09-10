import { brotliCompressSync, brotliDecompressSync, constants } from "node:zlib";

/**
 * Brotli quality for compressing stored match/timeline JSON. Measured on
 * real Arena payloads: quality 9 gets ~13-22x compression (vs Postgres's
 * own automatic TOAST/pglz compression, which only manages ~2-5x on the
 * same data) in single-digit milliseconds. Quality 11 (the zlib default)
 * shaves off another ~20-25% but takes ~2 seconds on a large timeline —
 * not worth it for a one-time ingestion-time cost. See CLAUDE.md for the
 * full measurements this was chosen from.
 */
const BROTLI_QUALITY = 9;

export function compressJson(value: unknown): Buffer {
  return brotliCompressSync(JSON.stringify(value), {
    params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
  });
}

export function decompressJson<T = unknown>(data: Buffer): T {
  return JSON.parse(brotliDecompressSync(data).toString("utf-8")) as T;
}
