/**
 * Recap check: makes sure every summoner with a recap has all their Arena
 * matches stored, then exits. A one-off, run now and then, never on a loop.
 *
 * A normal refresh (the site's or the crawler's) only asks Riot for games
 * since the previous refresh (minus a 2h overlap), so a gap further back
 * stays a gap: a match skipped as bad at the time, a game Riot published
 * late, an interrupted first fetch. This walks every summoner whose
 * `lastRefreshedAt` is set, asks Riot for their whole Arena history
 * (`ingestSummoner`'s `fullHistory`: one call per 100 games), and fetches
 * whatever isn't stored or known bad (2 calls per match). A match skipped
 * as failed earlier is tried again; bad ones (`bad_matches`) never are, and
 * new failures are logged in `skipped_matches` as usual. Each summoner checked gets a new
 * `lastRefreshedAt`: their matches are now fully fetched.
 *
 * The list is taken once at start, oldest `lastRefreshedAt` first, and split
 * into one worker per Riot regional cluster (europe, americas, asia, sea),
 * side by side like the crawler, since Riot's rate limits are per cluster.
 *
 * Ctrl-C / SIGTERM finishes each worker's current match and exits (a second
 * one exits at once); a rerun starts the list over. A fatal Riot error (key)
 * or five summoners failing in a row (an outage) stop it with exit code 1.
 *
 * Usage: pnpm --filter @arena/api check-recaps
 */
import { asc, sql, summoners, type Summoner } from "@arena/db";
import { isPlatform, matchRegion, toPlatform, type Region } from "@arena/riot";
import { db } from "../src/db.js";
import { ingestSummoner } from "../src/ingestion/ingestSummoner.js";
import { logger, riotIdLabel } from "../src/logger.js";
import { riotGateway } from "../src/riot.js";
import { errorMessage, isFatal, progressLogger } from "./script-helpers.js";

const scriptLog = logger.child({ module: "check-recaps" });
// Upkeep: behind the site's requests, ahead of the crawler's.
const riot = riotGateway.client("upkeep");

const LANES: Region[] = ["europe", "americas", "asia", "sea"];
const MAX_CONSECUTIVE_FAILURES = 5;

let stopRequested = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    scriptLog.info(`${signal}: stopping after the current match (again to quit now)`);
  });
}

type CheckTarget = Pick<Summoner, "puuid" | "region" | "riotIdGameName" | "riotIdTagline" | "lastRefreshedAt">;

const totals = { checked: 0, complete: 0, withGaps: 0, stored: 0, skipped: 0, bad: 0, discovered: 0, failed: 0 };
const startedAt = Date.now();

/** Every summoner with a recap, oldest refresh first. */
async function loadSummoners(): Promise<CheckTarget[]> {
  return db
    .select({
      puuid: summoners.puuid,
      region: summoners.region,
      riotIdGameName: summoners.riotIdGameName,
      riotIdTagline: summoners.riotIdTagline,
      lastRefreshedAt: summoners.lastRefreshedAt,
    })
    .from(summoners)
    .where(sql`${summoners.lastRefreshedAt} is not null`)
    .orderBy(asc(summoners.lastRefreshedAt), asc(summoners.puuid));
}

/** Checks one regional cluster's summoners, one after another. Throws on a fatal Riot error or an outage. */
async function checkLane(lane: Region, list: CheckTarget[]) {
  const laneLog = scriptLog.child({ lane });
  const log = (message: string) => laneLog.info(message);
  if (list.length === 0) return;
  log(`${list.length} summoner(s) to check`);
  let consecutiveFailures = 0;

  for (const [index, summoner] of list.entries()) {
    if (stopRequested) return;
    const name = riotIdLabel(summoner);
    const position = `${index + 1}/${list.length}`;
    let missing = 0;
    const logProgress = progressLogger(name, log);
    try {
      const result = await ingestSummoner(
        db,
        riot,
        summoner,
        (progress) => {
          if (progress.phase === "matches" && progress.done === 0) missing = progress.total;
          if (progress.phase === "matches") logProgress(progress);
        },
        {
          fullHistory: true,
          shouldStop: () => stopRequested,
          onSkip: (skip) => {
            const status = skip.riotStatus ? ` ${skip.riotStatus}` : "";
            laneLog.warn(`  ${name}: match ${skip.matchId} failed, skipped (${skip.stage}${status}): ${skip.error}`);
          },
          onBadMatch: (badMatch) => {
            laneLog.info(
              `  ${name}: bad match ${badMatch.matchId} (${badMatch.endOfGameResult}), won't be fetched again`,
            );
          },
        },
      );
      totals.stored += result.ingested;
      totals.skipped += result.skipped;
      totals.bad += result.bad;
      totals.discovered += result.discovered;
      if (result.stopped) {
        log(`${position} ${name}: stopped early, rerun to check again`);
        return;
      }
      totals.checked += 1;
      consecutiveFailures = 0;
      if (missing === 0) {
        totals.complete += 1;
        log(`${position} ${name} (${summoner.region}): complete`);
      } else {
        totals.withGaps += 1;
        const skipped =
          (result.skipped > 0 ? `, ${result.skipped} failed match(es) skipped` : "") +
          (result.bad > 0 ? `, ${result.bad} bad match(es)` : "");
        log(`${position} ${name} (${summoner.region}): ${missing} missing, ${result.ingested} stored${skipped}`);
      }
    } catch (err) {
      if (isFatal(err)) throw err;
      totals.failed += 1;
      consecutiveFailures += 1;
      laneLog.error(`${position} ${name} failed, moving on: ${errorMessage(err)}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(
          `${consecutiveFailures} summoners failed in a row, looks like an outage (network, database or Riot); nothing was half-written. Rerun when it's back.`,
          { cause: err },
        );
      }
    }
  }
  log("lane done");
}

async function main() {
  const all = await loadSummoners();
  const byLane = new Map<Region, CheckTarget[]>(LANES.map((lane) => [lane, []]));
  for (const summoner of all) {
    if (!isPlatform(summoner.region)) {
      scriptLog.warn(`${riotIdLabel(summoner)}: unknown platform "${summoner.region}", skipped`);
      continue;
    }
    byLane.get(matchRegion(toPlatform(summoner.region)))!.push(summoner);
  }
  scriptLog.info(
    `starting: ${all.length} summoner(s) with a recap, ` +
      LANES.map((lane) => `${lane} ${byLane.get(lane)!.length}`).join(", "),
  );

  const results = await Promise.allSettled(
    LANES.map((lane) =>
      checkLane(lane, byLane.get(lane)!).catch((err) => {
        // A fatal error or an outage in one lane stops the others too.
        stopRequested = true;
        throw new Error(`${lane}: ${errorMessage(err)}`);
      }),
    ),
  );

  const minutes = ((Date.now() - startedAt) / 60_000).toFixed(1);
  scriptLog.info(
    `${stopRequested ? "stopped" : "done"} in ${minutes} min: ${totals.checked}/${all.length} summoner(s) checked, ` +
      `${totals.complete} complete, ${totals.withGaps} with missing matches (${totals.stored} match(es) stored, ` +
      `${totals.skipped} failed match(es) skipped, ${totals.bad} bad), ${totals.discovered} new player(s), ${totals.failed} failed`,
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
