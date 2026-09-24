/**
 * Crawler: grows the database by walking from player to player.
 *
 * Each step takes the summoner with the oldest `lastRefreshedAt` (never
 * refreshed first), refreshes their Riot ID/icon/level from account-v1 and
 * summoner-v4, ingests their new Arena matches, and adds every player
 * met in those matches to `summoners`, who then queue up for their own
 * turn. Matches shared between players are stored once (see
 * `ingestSummoner`), so a match is never fetched twice.
 *
 * Its one goal is discovery: absorb as many matches as possible, not keep
 * anyone's recap fresh (the page's refresh does that). Once a lane has
 * nobody left who was never refreshed, --forever keeps going through the
 * lane's refreshed summoners, oldest refresh first (none refreshed in the
 * last 15 minutes), and switches back to a never-refreshed one as soon as a
 * match brings one in.
 *
 * One worker per Riot regional cluster (europe, americas, asia, sea), side by
 * side, like the API's refresh queue: Riot's rate limits are per cluster, so
 * an NA crawl never waits behind an EUW one.
 *
 * Seeding: a platform with no summoner at all (see `CRAWL_SEEDS`) is started
 * from a top arenasweats.lol player, looked up at Riot and crawled first.
 *
 * Two modes:
 *   pnpm --filter @arena/api crawl [--summoners N]
 *     By hand. Ends when nobody in a lane is left unrefreshed (or after about
 *     N summoners). A fatal Riot error (key) or five failures in a row (an
 *     outage) end it.
 *   pnpm --filter @arena/api crawl:forever
 *     Hosted: the Railway `crawler` service's start command. Never
 *     ends on its own: it keeps going through the refreshed summoners (see
 *     above), a lane with nobody to crawl yet looks again every minute, and
 *     errors are waited out and retried instead of exiting.
 * In both, Ctrl-C / SIGTERM finishes each worker's current match and exits
 * (an interrupted summoner resumes next run); a second one exits at once.
 *
 * Runs in its own process, next to the live site: its Riot calls go through
 * the Riot gateway in the `crawler` bucket, the lowest, so on each Riot host
 * they only go out when no visitor lookup, refresh or first fetch is waiting.
 */
import { parseArgs } from "node:util";
import type { Logger } from "pino";
import { and, asc, eq, inArray, isNull, lt, or, sql, summoners, type Summoner } from "@arena/db";
import { db } from "../src/db.js";
import { logger, riotIdLabel } from "../src/logger.js";
import { PLATFORMS, matchRegion, type Platform, type Region } from "@arena/riot";
import { ingestSummoner, type BadMatch, type SkippedMatch } from "../src/ingestion/ingestSummoner.js";
import { refreshSummonerProfile, resolveSummonerByRiotId } from "../src/ingestion/resolveSummoner.js";
import { riotGateway } from "../src/riot.js";
import { CRAWL_SEEDS } from "./crawl-seeds.js";
import { errorMessage, isFatal, progressLogger } from "./script-helpers.js";

const scriptLog = logger.child({ module: "crawl" });
const riot = riotGateway.client("crawler");

const { values: args } = parseArgs({
  options: { summoners: { type: "string" }, forever: { type: "boolean", default: false } },
});
const forever = args.forever;
const maxSummoners = args.summoners ? Number(args.summoners) : Infinity;
if (!(maxSummoners > 0)) throw new Error("--summoners must be a positive number");

const LANES: Region[] = ["europe", "americas", "asia", "sea"];

const MAX_CONSECUTIVE_FAILURES = 5;
// --forever only. A summoner whose refresh failed is skipped this long.
const FAILED_RETRY_MS = 60 * 60_000;
// --forever only. A refreshed summoner is crawled again only this long after
// their last refresh, like the API's REFRESH_COOLDOWN_MS: without it, a lane
// with a handful of players would refresh them non-stop.
const MIN_REFRESH_GAP_MS = 15 * 60_000;
// Nobody to crawl in the lane (--forever): wait this long, then look again.
const IDLE_SLEEP_MS = 60_000;
// Several summoners failing in a row (network, database or Riot down): wait,
// doubling each time it happens again, up to OUTAGE_SLEEP_MAX_MS.
const OUTAGE_SLEEP_MS = 60_000;
const OUTAGE_SLEEP_MAX_MS = 30 * 60_000;
// A fatal Riot error (expired key, PUUIDs from another app) fails every
// summoner the same way; retrying sooner would only spend calls. Changing
// RIOT_API_KEY redeploys the gateway, and the next try goes through.
const FATAL_SLEEP_MS = 30 * 60_000;

let stopRequested = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    scriptLog.info(`${signal}: stopping after the current match (again to quit now)`);
  });
}
if (forever) {
  // A stray rejected promise must not take the hosted process down.
  process.on("unhandledRejection", (err) => {
    scriptLog.error(`unhandled rejection: ${err instanceof Error ? err.message : err}`);
  });
}

/** Waits `ms`, but wakes up within a second of a stop request. */
async function sleep(ms: number) {
  const until = Date.now() + ms;
  while (!stopRequested && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000, until - Date.now())));
  }
}

type CrawlTarget = Pick<Summoner, "puuid" | "region" | "riotIdGameName" | "riotIdTagline" | "lastRefreshedAt">;

/** This lane's platforms that have a seed list but no summoner yet. */
async function unseededPlatforms(platforms: Platform[]) {
  const unseeded: Platform[] = [];
  for (const platform of platforms) {
    if (!CRAWL_SEEDS[platform]) continue;
    const [row] = await db
      .select({ puuid: summoners.puuid })
      .from(summoners)
      .where(eq(summoners.region, platform))
      .limit(1);
    if (!row) unseeded.push(platform);
  }
  return unseeded;
}

/**
 * Looks up the platform's seed players at Riot until one exists, and stores
 * them. "gone" when none does (the list needs refilling), "retry" when Riot
 * or the network failed before an answer.
 */
async function seedPlatform(
  platform: Platform,
  log: (message: string) => void,
): Promise<CrawlTarget | "gone" | "retry"> {
  for (const { gameName, tagLine } of CRAWL_SEEDS[platform] ?? []) {
    try {
      const summoner = await resolveSummonerByRiotId(riot, platform, gameName, tagLine);
      if (!summoner) {
        log(`${platform}: seed ${gameName}#${tagLine} not found at Riot, trying the next`);
        continue;
      }
      log(`${platform}: no summoners yet, seeded with ${riotIdLabel(summoner)}`);
      return summoner;
    } catch (err) {
      if (isFatal(err)) throw err;
      log(`${platform}: seed lookup failed (${errorMessage(err)}), retrying later`);
      return "retry";
    }
  }
  log(`${platform}: none of its seeds exist at Riot any more, skipping it. Refill it in scripts/crawl-seeds.ts`);
  return "gone";
}

/** The lane's next summoner, never refreshed first, then oldest refresh
 * first (--forever only, not refreshed in the last MIN_REFRESH_GAP_MS),
 * minus ones backing off. */
async function nextSummoner(platforms: Platform[], skip: ReadonlySet<string>): Promise<CrawlTarget | undefined> {
  const due = forever
    ? // Column operators, not raw `sql`: they convert the Date for the driver,
      // which a raw fragment passes through as is (postgres.js then rejects it).
      or(isNull(summoners.lastRefreshedAt), lt(summoners.lastRefreshedAt, new Date(Date.now() - MIN_REFRESH_GAP_MS)))
    : isNull(summoners.lastRefreshedAt);
  const candidates = await db
    .select({
      puuid: summoners.puuid,
      region: summoners.region,
      riotIdGameName: summoners.riotIdGameName,
      riotIdTagline: summoners.riotIdTagline,
      lastRefreshedAt: summoners.lastRefreshedAt,
    })
    .from(summoners)
    .where(and(inArray(summoners.region, platforms), due))
    .orderBy(sql`${summoners.lastRefreshedAt} asc nulls first`, asc(summoners.puuid))
    .limit(skip.size + 1);
  return candidates.find((candidate) => !skip.has(candidate.puuid));
}

/**
 * Brings the summoner's Riot ID, icon and level up to date before their
 * matches (`refreshSummonerProfile`), and returns their current "name#tag".
 * A failure here is logged, not thrown: the matches are still worth
 * fetching with a stale name. Fatal errors (key, PUUID app) still throw.
 */
async function refreshProfile(summoner: CrawlTarget, log: (message: string) => void) {
  const stored = riotIdLabel(summoner);
  try {
    const name = riotIdLabel(await refreshSummonerProfile(riot, summoner));
    if (name !== stored) log(`  ${stored} is now ${name}`);
    return name;
  } catch (err) {
    if (isFatal(err)) throw err;
    log(`  ${stored}: profile refresh failed, keeping the stored one: ${errorMessage(err)}`);
    return stored;
  }
}

/** A failed match left out of the database until a later refresh (see `ingestSummoner`): logged here and in `skipped_matches`. */
function skipLogger(name: string, laneLog: Logger) {
  return (skip: SkippedMatch) => {
    totals.skipped += 1;
    const status = skip.riotStatus ? ` ${skip.riotStatus}` : "";
    laneLog.warn(`  ${name}: match ${skip.matchId} failed, skipped (${skip.stage}${status}): ${skip.error}`);
  };
}

/** A bad match, never fetched again (see `ingestSummoner`): logged here and in `bad_matches`. */
function badMatchLogger(name: string, laneLog: Logger) {
  return (badMatch: BadMatch) => {
    totals.bad += 1;
    laneLog.info(`  ${name}: bad match ${badMatch.matchId} (${badMatch.endOfGameResult}), won't be fetched again`);
  };
}

async function counts() {
  const [row] = await db.execute<{ summoners: number; pending: number; matches: number }>(sql`
    select
      (select count(*) from summoners)::int as summoners,
      (select count(*) from summoners where last_refreshed_at is null)::int as pending,
      (select count(*) from matches)::int as matches
  `);
  return row!;
}

// Totals across every lane.
const totals = { crawled: 0, ingested: 0, skipped: 0, bad: 0, discovered: 0, failed: 0 };
const startedAt = Date.now();

/**
 * Crawls one regional cluster's platforms until nobody is left unrefreshed
 * (by hand) or forever (--forever). Throws only by hand, on a fatal Riot
 * error or an outage; --forever waits both out.
 */
async function crawlLane(lane: Region) {
  const platforms = PLATFORMS.filter((platform) => matchRegion(platform) === lane);
  const laneLog = scriptLog.child({ lane });
  const log = (message: string) => laneLog.info(message);

  // Seeded summoners go first: behind the lane's never-refreshed backlog a
  // new platform could wait days for its first crawl.
  const priority: CrawlTarget[] = [];
  let unseeded = await unseededPlatforms(platforms);
  // puuid -> when it may be tried again (never, by hand).
  const failedUntil = new Map<string, number>();
  let consecutiveFailures = 0;
  let outageSleepMs = OUTAGE_SLEEP_MS;
  // Logged once per idle spell, not on every look.
  let idle = false;

  while (!stopRequested && totals.crawled < maxSummoners) {
    try {
      if (unseeded.length > 0) {
        const retry: Platform[] = [];
        for (const platform of unseeded) {
          const seeded = await seedPlatform(platform, log);
          if (seeded === "retry") retry.push(platform);
          else if (seeded !== "gone") priority.push(seeded);
        }
        unseeded = retry;
      }

      const now = Date.now();
      for (const [puuid, until] of failedUntil) if (until <= now) failedUntil.delete(puuid);
      const summoner = priority.shift() ?? (await nextSummoner(platforms, new Set(failedUntil.keys())));
      if (!summoner) {
        if (!forever) {
          if (unseeded.length > 0) log(`seeds for ${unseeded.join(", ")} could not be looked up, rerun to retry`);
          log("nobody left unrefreshed, lane done");
          return;
        }
        if (!idle) log("nobody refreshed over 15 min ago, waiting");
        idle = true;
        await sleep(IDLE_SLEEP_MS);
        continue;
      }
      idle = false;

      const last = summoner.lastRefreshedAt ? summoner.lastRefreshedAt.toISOString() : "never";
      let name = riotIdLabel(summoner);
      log(`${name} (${summoner.region}, last refreshed ${last})`);
      try {
        name = await refreshProfile(summoner, log);
        const result = await ingestSummoner(db, riot, summoner, progressLogger(name, log), {
          shouldStop: () => stopRequested,
          onSkip: skipLogger(name, laneLog),
          onBadMatch: badMatchLogger(name, laneLog),
        });
        totals.ingested += result.ingested;
        totals.discovered += result.discovered;
        if (result.stopped) {
          log(`  ${name}: stopped early, resumes on the next run`);
          return;
        }
        totals.crawled += 1;
        consecutiveFailures = 0;
        outageSleepMs = OUTAGE_SLEEP_MS;
        const skipped =
          (result.skipped > 0 ? `, ${result.skipped} failed match(es) skipped` : "") +
          (result.bad > 0 ? `, ${result.bad} bad match(es)` : "");
        log(`  ${name}: done, ${result.ingested} match(es) stored${skipped}, ${result.discovered} new player(s)`);
      } catch (err) {
        if (isFatal(err)) {
          if (!forever) throw err;
          laneLog.error(
            `fatal Riot error, every summoner would fail the same way (check the gateway's RIOT_API_KEY, and RIOT_GATEWAY_SECRET): ${errorMessage(err)}. Retrying in ${FATAL_SLEEP_MS / 60_000} min`,
          );
          priority.unshift(summoner);
          await sleep(FATAL_SLEEP_MS);
          continue;
        }
        failedUntil.set(summoner.puuid, forever ? Date.now() + FAILED_RETRY_MS : Infinity);
        totals.failed += 1;
        consecutiveFailures += 1;
        laneLog.error(
          `${name} failed, ${forever ? `retrying them in ${FAILED_RETRY_MS / 60_000} min` : "skipping for this run"}: ${errorMessage(err)}`,
        );
        if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          const outage = `${consecutiveFailures} summoners failed in a row, looks like an outage (network, database or Riot); nothing was half-written`;
          if (!forever) throw new Error(`${outage}. Rerun when it's back.`, { cause: err });
          laneLog.error(`${outage}. Waiting ${Math.round(outageSleepMs / 60_000)} min`);
          await sleep(outageSleepMs);
          outageSleepMs = Math.min(outageSleepMs * 2, OUTAGE_SLEEP_MAX_MS);
          consecutiveFailures = 0;
          // The failures were the outage, not those players: retry them all.
          failedUntil.clear();
        }
        continue;
      }

      const stored = await counts();
      const minutes = (Date.now() - startedAt) / 60_000;
      log(
        `  run: ${totals.crawled} summoner(s), ${totals.ingested} new match(es), ${totals.discovered} new player(s) in ${minutes.toFixed(1)} min` +
          ` · db: ${stored.matches} matches, ${stored.summoners} summoners (${stored.pending} never refreshed)`,
      );
    } catch (err) {
      if (!forever) throw err;
      // The database itself failed (picking the next summoner, the counts):
      // wait for it to come back. postgres.js reconnects on the next query.
      laneLog.error(`database error, retrying in ${OUTAGE_SLEEP_MS / 60_000} min: ${errorMessage(err)}`);
      await sleep(OUTAGE_SLEEP_MS);
    }
  }
}

async function main() {
  scriptLog.info(
    `starting${forever ? " (forever)" : ""}: ${forever ? "never-refreshed summoners first, then oldest refresh first" : "never-refreshed summoners"}` +
      `${Number.isFinite(maxSummoners) ? `, stops after ~${maxSummoners} summoner(s)` : ""}, lanes: ${LANES.join(", ")}`,
  );
  const results = await Promise.allSettled(
    LANES.map((lane) =>
      crawlLane(lane).catch((err) => {
        // One lane hitting a fatal error or an outage stops the others too.
        stopRequested = true;
        throw new Error(`${lane}: ${errorMessage(err)}`);
      }),
    ),
  );

  scriptLog.info(
    `done: ${totals.crawled} summoner(s) refreshed, ${totals.ingested} match(es) stored, ${totals.skipped} failed match(es) skipped, ${totals.bad} bad match(es) found, ${totals.discovered} player(s) discovered, ${totals.failed} failed`,
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
