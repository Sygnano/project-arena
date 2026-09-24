/**
 * Helpers shared by the ingestion scripts (`crawl.ts`, `check-recaps.ts`, `retry-skipped.ts`).
 */
import { RiotApiError } from "@arena/riot";
import type { IngestProgress } from "../src/ingestion/ingestSummoner.js";

/** The innermost cause's message: for a database error, the driver's reason
 * rather than Drizzle's wrapper, which only quotes the failed query. */
export function errorMessage(err: unknown) {
  let current = err;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  return current instanceof Error ? current.message : String(current);
}

/** Errors that will fail every summoner the same way. */
export function isFatal(err: unknown) {
  // 401/403: missing or expired key (or the wrong gateway secret). 400
  // "decrypting": PUUIDs from another Riot app (see CLAUDE.md §2).
  return err instanceof RiotApiError && err.fatal;
}

/** Logs a refresh's progress: the match count once ids are in, then every match. */
export function progressLogger(name: string, log: (message: string) => void) {
  let startedAt = 0;
  return (progress: IngestProgress) => {
    if (progress.phase === "matchIds") {
      log(`  ${name}: fetching match ids`);
      return;
    }
    if (progress.done === 0) {
      startedAt = Date.now();
      if (progress.total > 0) log(`  ${name}: ${progress.total} new match(es) to fetch`);
      return;
    }
    const perMatchMs = (Date.now() - startedAt) / progress.done;
    const etaMin = ((progress.total - progress.done) * perMatchMs) / 60_000;
    log(`  ${name}: match ${progress.done}/${progress.total} done (~${etaMin.toFixed(1)} min left)`);
  };
}
