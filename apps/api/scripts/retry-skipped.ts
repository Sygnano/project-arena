/**
 * Retries failed matches: fetches every match in `skipped_matches` again,
 * then exits. Meant as a Railway cron job.
 *
 * A failed match is otherwise only retried when a refresh lists it again,
 * and a refresh only asks Riot for games since the previous one (minus a 2h
 * overlap). So a match that failed during someone's refresh stays missing
 * until another of its players is refreshed for the first time, or
 * `check-recaps` runs. This retries them directly, 2 Riot calls each
 * (match + timeline), through `fetchMatch` like any refresh:
 *   - stored now: its row is deleted (in the same transaction);
 *   - stored or found bad by someone else since: its row is deleted, no call;
 *   - bad (Riot says the game didn't end normally): moved to `bad_matches`;
 *   - failed again: its row is updated (stage, error, `times_skipped` + 1).
 *
 * The list is taken once at start, longest since its last try first, and
 * split by the match's platform into one worker per Riot regional cluster
 * (europe, americas, asia, sea), side by side like the crawler.
 *
 * Exits with code 1 on a fatal Riot error (key), on an outage (five matches
 * in a row that couldn't be tried), or when matches keep failing the same
 * way at parse or store (`RepeatedFailureError`: a bug to fix first, and
 * retrying the rest would only spend calls). Every row not reached stays for
 * the next run. Ctrl-C / SIGTERM finishes each worker's current match and
 * exits (a second one exits at once).
 *
 * Usage: pnpm --filter @arena/api retry-skipped
 */
import { asc, skippedMatches } from "@arena/db";
import { matchRegion, platformOfMatch, type Region } from "@arena/riot";
import { db } from "../src/db.js";
import { FailureBreaker, fetchMatch, type MatchOutcome } from "../src/ingestion/ingestSummoner.js";
import { logger } from "../src/logger.js";
import { riotGateway } from "../src/riot.js";
import { errorMessage, isFatal } from "./script-helpers.js";

const scriptLog = logger.child({ module: "retry-skipped" });
// Upkeep: behind the site's requests, ahead of the crawler's.
const riot = riotGateway.client("upkeep");

const LANES: Region[] = ["europe", "americas", "asia", "sea"];
const MAX_CONSECUTIVE_ERRORS = 5;

let stopRequested = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    scriptLog.info(`${signal}: stopping after the current match (again to quit now)`);
  });
}

type RetryTarget = { matchId: string; seenInPuuid: string; timesSkipped: number };

const totals = { stored: 0, known: 0, bad: 0, failed: 0, errors: 0 };
const startedAt = Date.now();

function describe(outcome: MatchOutcome) {
  switch (outcome.kind) {
    case "stored":
      return `stored${outcome.discovered > 0 ? `, ${outcome.discovered} new player(s)` : ""}`;
    case "known":
      return "already stored or bad, row removed";
    case "bad":
      return `bad match (${outcome.badMatch.endOfGameResult}), won't be fetched again`;
    case "failed": {
      const status = outcome.skip.riotStatus ? ` ${outcome.skip.riotStatus}` : "";
      return `failed again (${outcome.skip.stage}${status}): ${outcome.skip.error}`;
    }
  }
}

/** Retries one regional cluster's matches, one after another. Throws on a
 * fatal Riot error, an outage or a repeated failure. */
async function retryLane(lane: Region, list: RetryTarget[]) {
  const laneLog = scriptLog.child({ lane });
  const log = (message: string) => laneLog.info(message);
  if (list.length === 0) return;
  log(`${list.length} match(es) to retry`);
  const breaker = new FailureBreaker();
  let consecutiveErrors = 0;

  for (const [index, { matchId, seenInPuuid, timesSkipped }] of list.entries()) {
    if (stopRequested) return;
    const position = `${index + 1}/${list.length}`;
    let outcome: MatchOutcome;
    try {
      outcome = await fetchMatch(db, riot, matchId, seenInPuuid);
    } catch (err) {
      if (isFatal(err)) throw err;
      totals.errors += 1;
      consecutiveErrors += 1;
      laneLog.error(`${position} ${matchId}: couldn't be tried, left for the next run: ${errorMessage(err)}`);
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        throw new Error(
          `${consecutiveErrors} matches in a row couldn't be tried, looks like an outage (network, database or Riot)`,
          {
            cause: err,
          },
        );
      }
      continue;
    }
    consecutiveErrors = 0;
    totals[outcome.kind] += 1;
    const line = `${position} ${matchId} (failed ${timesSkipped} time(s) before): ${describe(outcome)}`;
    if (outcome.kind === "failed") laneLog.warn(line);
    else log(line);
    breaker.record(outcome);
  }
  log("lane done");
}

async function main() {
  const all = await db
    .select({
      matchId: skippedMatches.matchId,
      seenInPuuid: skippedMatches.seenInPuuid,
      timesSkipped: skippedMatches.timesSkipped,
    })
    .from(skippedMatches)
    .orderBy(asc(skippedMatches.lastSkippedAt), asc(skippedMatches.matchId));
  const byLane = new Map<Region, RetryTarget[]>(LANES.map((lane) => [lane, []]));
  let unroutable = 0;
  for (const row of all) {
    try {
      byLane.get(matchRegion(platformOfMatch(row.matchId)))!.push(row);
    } catch {
      // A platform Riot added or retired: nothing to call until routing.ts knows it.
      unroutable += 1;
      scriptLog.warn(`${row.matchId}: unknown platform, left as is`);
    }
  }
  scriptLog.info(
    `starting: ${all.length} failed match(es), ` +
      LANES.map((lane) => `${lane} ${byLane.get(lane)!.length}`).join(", "),
  );

  const results = await Promise.allSettled(
    LANES.map((lane) =>
      retryLane(lane, byLane.get(lane)!).catch((err) => {
        // A fatal error, an outage or a repeated failure (the code's fault,
        // not the lane's) in one lane stops the others too.
        stopRequested = true;
        throw new Error(`${lane}: ${errorMessage(err)}`);
      }),
    ),
  );

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  scriptLog.info(
    `${stopRequested ? "stopped" : "done"} in ${minutes} min: ${totals.stored} stored, ${totals.known} already stored, ` +
      `${totals.bad} bad, ${totals.failed} failed again, ${totals.errors} not tried (errors)` +
      (unroutable > 0 ? `, ${unroutable} on an unknown platform` : ""),
  );
  const failures = results.flatMap((result) => (result.status === "rejected" ? [errorMessage(result.reason)] : []));
  if (failures.length > 0) throw new Error(failures.join("; "));
  await db.$client.end();
}

main().catch(async (err) => {
  scriptLog.error(`aborted: ${errorMessage(err)}`);
  await db.$client.end().catch(() => {});
  process.exit(1);
});
