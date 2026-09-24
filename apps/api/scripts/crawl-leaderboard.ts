/**
 * Leaderboard crawler: fetches the players at the top of arenasweats.lol's
 * global Arena leaderboard, the ones most likely to keep playing Arena and to
 * look up their own stats.
 *
 * One page of the leaderboard at a time (125 ranks, the most arenasweats
 * serves per call) is split into one bucket per Riot regional cluster (the
 * refresh queue's lanes, see `crawl.ts`), by each player's region. Each lane's
 * worker takes its bucket's players in rank order: looks their Riot ID up at
 * Riot (account-v1 + summoner-v4) and ingests their Arena matches. When a
 * lane's bucket is empty it fetches the next page, which refills every
 * bucket, so arenasweats gets one call per 125 players. Buckets have no
 * size limit: europe gets about 45% of each page but crawls no faster than
 * sea, so its bucket grows while the lanes that run dry first keep fetching
 * pages. The ranking moves while the crawl goes down it, so some players are
 * met twice and some never; that's fine. Past the last rank it starts again
 * from rank 1. A restart starts from rank 1 too (or --start-rank).
 *
 * A player refreshed in the last SKIP_IF_REFRESHED_WITHIN_MS (by this
 * crawler, the other one or a visitor) is skipped without a Riot call.
 * Every player met in their matches is added to `summoners`, where the
 * discovery crawler (`crawl.ts`) picks them up.
 *
 *   pnpm --filter @arena/api crawl:leaderboard [--start-rank N] [--players N]
 *
 * Never ends on its own (--players N stops after about N players refreshed): Riot and
 * arenasweats errors are waited out and retried. Hosted as its own Railway
 * service, a copy of `crawler` with the start command
 * `node --enable-source-maps apps/api/dist/scripts/crawl-leaderboard.mjs`.
 * Ctrl-C / SIGTERM finishes each worker's current match and exits; a second
 * one exits at once.
 *
 * Its Riot calls wait in the gateway's `crawler` bucket, like `crawl.ts`: they
 * only go out when no visitor lookup, refresh or first fetch is waiting.
 */
import { parseArgs } from "node:util";
import type { Logger } from "pino";
import { z } from "zod";
import { matchRegion, type Platform, type Region } from "@arena/riot";
import { db } from "../src/db.js";
import { logger, riotIdLabel } from "../src/logger.js";
import { ingestSummoner, type BadMatch, type SkippedMatch } from "../src/ingestion/ingestSummoner.js";
import { resolveSummonerByRiotId } from "../src/ingestion/resolveSummoner.js";
import { riotGateway } from "../src/riot.js";
import { findSummonerByRiotId } from "../src/summoners/summonerRepository.js";
import { errorMessage, isFatal, progressLogger } from "./script-helpers.js";

const scriptLog = logger.child({ module: "crawl-leaderboard" });
const riot = riotGateway.client("crawler");

const { values: args } = parseArgs({
  options: { "start-rank": { type: "string" }, players: { type: "string" } },
});
const startRank = args["start-rank"] ? Number(args["start-rank"]) : 1;
if (!(Number.isInteger(startRank) && startRank >= 1)) throw new Error("--start-rank must be a positive integer");
const maxPlayers = args.players ? Number(args.players) : Infinity;
if (!(maxPlayers > 0)) throw new Error("--players must be a positive number");

const LANES: Region[] = ["europe", "americas", "asia", "sea"];

const LEADERBOARD_URL = "https://arenasweats.lol/api/leaderboard";
// arenasweats answers 400 to a wider range.
const PAGE_SIZE = 125;
const FETCH_TIMEOUT_MS = 30_000;
// Their recap is already up to date: a few new games at most, not worth the
// 3+ Riot calls. Also makes the ranks a restart goes through again free.
const SKIP_IF_REFRESHED_WITHIN_MS = 6 * 60 * 60_000;

// arenasweats' region names (the leaderboard's `region` field).
const ARENASWEATS_PLATFORMS: Record<string, Platform> = {
  br: "br1",
  eune: "eun1",
  euw: "euw1",
  jp: "jp1",
  kr: "kr",
  lan: "la1",
  las: "la2",
  me: "me1",
  na: "na1",
  oce: "oc1",
  ru: "ru",
  sea: "sg2",
  tr: "tr1",
  tw: "tw2",
  vn: "vn2",
};

const MAX_CONSECUTIVE_FAILURES = 5;
// Several players failing in a row (network, database or Riot down), or
// arenasweats failing: wait, doubling each time it happens again.
const OUTAGE_SLEEP_MS = 60_000;
const OUTAGE_SLEEP_MAX_MS = 30 * 60_000;
// A fatal Riot error (expired key, wrong gateway secret) fails every player
// the same way; retrying sooner would only spend calls.
const FATAL_SLEEP_MS = 30 * 60_000;

let stopRequested = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    if (stopRequested) process.exit(130);
    stopRequested = true;
    scriptLog.info(`${signal}: stopping after the current match (again to quit now)`);
  });
}
// A stray rejected promise must not take the hosted process down.
process.on("unhandledRejection", (err) => {
  scriptLog.error(`unhandled rejection: ${err instanceof Error ? err.message : err}`);
});

/** Waits `ms`, but wakes up within a second of a stop request. */
async function sleep(ms: number) {
  const until = Date.now() + ms;
  while (!stopRequested && Date.now() < until) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000, until - Date.now())));
  }
}

interface LeaderboardPlayer {
  rank: number;
  platform: Platform;
  gameName: string;
  tagLine: string;
}

const leaderboardPage = z.object({
  data: z.array(z.object({ rank: z.number(), player_name: z.string(), region: z.string() })),
});

/** One page of the global leaderboard, from `from` on. Empty past the last rank. */
async function fetchLeaderboardPage(from: number) {
  const url = new URL(LEADERBOARD_URL);
  url.search = new URLSearchParams({
    start_rank: String(from),
    end_rank: String(from + PAGE_SIZE - 1),
    region: "global",
    season: "live",
  }).toString();
  const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`arenasweats answered ${response.status}`);
  return leaderboardPage.parse(await response.json()).data;
}

/**
 * The leaderboard, one bucket of players per lane. A lane asking for its next
 * player while its bucket is empty fetches the next page; lanes asking at the
 * same time share that one fetch.
 */
class Leaderboard {
  private nextRank = startRank;
  private readonly buckets = new Map<Region, LeaderboardPlayer[]>(LANES.map((lane) => [lane, []]));
  private fetching: Promise<void> | undefined;
  private fetchFailSleepMs = OUTAGE_SLEEP_MS;

  /** The lane's next player, undefined once a stop is requested. */
  async next(lane: Region): Promise<LeaderboardPlayer | undefined> {
    const bucket = this.buckets.get(lane)!;
    while (bucket.length === 0 && !stopRequested) {
      this.fetching ??= this.fetchNextPage().finally(() => (this.fetching = undefined));
      await this.fetching;
    }
    return bucket.shift();
  }

  /** Puts a player back at the front of their lane's bucket (a fatal error: tried again after the wait). */
  putBack(lane: Region, player: LeaderboardPlayer) {
    this.buckets.get(lane)!.unshift(player);
  }

  private async fetchNextPage() {
    const from = this.nextRank;
    let rows;
    try {
      rows = await fetchLeaderboardPage(from);
    } catch (err) {
      scriptLog.error(
        `leaderboard ranks ${from}+: ${errorMessage(err)}, retrying in ${Math.round(this.fetchFailSleepMs / 60_000)} min`,
      );
      await sleep(this.fetchFailSleepMs);
      this.fetchFailSleepMs = Math.min(this.fetchFailSleepMs * 2, OUTAGE_SLEEP_MAX_MS);
      return;
    }
    this.fetchFailSleepMs = OUTAGE_SLEEP_MS;

    if (rows.length === 0) {
      if (from === 1) {
        scriptLog.error(`leaderboard is empty, retrying in ${OUTAGE_SLEEP_MS / 60_000} min`);
        await sleep(OUTAGE_SLEEP_MS);
      } else {
        scriptLog.info(`leaderboard ends before rank ${from}, starting again from rank 1`);
      }
      this.nextRank = 1;
      return;
    }
    this.nextRank = from + PAGE_SIZE;

    const unknownRegions = new Set<string>();
    for (const row of rows) {
      const platform = ARENASWEATS_PLATFORMS[row.region.toLowerCase()];
      if (!platform) {
        unknownRegions.add(row.region);
        continue;
      }
      // "name#tag": the tag can't hold a "#", the name could.
      const hash = row.player_name.lastIndexOf("#");
      if (hash <= 0 || hash === row.player_name.length - 1) continue;
      this.buckets.get(matchRegion(platform))!.push({
        rank: row.rank,
        platform,
        gameName: row.player_name.slice(0, hash),
        tagLine: row.player_name.slice(hash + 1),
      });
    }
    const sizes = LANES.map((lane) => `${lane} ${this.buckets.get(lane)!.length}`).join(", ");
    scriptLog.info(
      `leaderboard ranks ${from}-${from + rows.length - 1} fetched, buckets: ${sizes}` +
        (unknownRegions.size > 0 ? ` (unknown regions left out: ${[...unknownRegions].join(", ")})` : ""),
    );
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

// Totals across every lane.
const totals = {
  crawled: 0,
  upToDate: 0,
  notFound: 0,
  ingested: 0,
  skipped: 0,
  bad: 0,
  discovered: 0,
  failed: 0,
};
const startedAt = Date.now();

/**
 * Crawls one lane's players. Returns only on a stop request or after
 * --players; every error is waited out.
 */
async function crawlLane(lane: Region, leaderboard: Leaderboard) {
  const laneLog = scriptLog.child({ lane });
  const log = (message: string) => laneLog.info(message);
  let consecutiveFailures = 0;
  let outageSleepMs = OUTAGE_SLEEP_MS;

  while (!stopRequested && totals.crawled < maxPlayers) {
    const player = await leaderboard.next(lane);
    if (!player) return;
    let name = `${player.gameName}#${player.tagLine}`;

    try {
      const stored = await findSummonerByRiotId(player.platform, player.gameName, player.tagLine);
      if (stored?.lastRefreshedAt && Date.now() - stored.lastRefreshedAt.getTime() < SKIP_IF_REFRESHED_WITHIN_MS) {
        totals.upToDate += 1;
        continue;
      }

      log(`#${player.rank} ${name} (${player.platform})`);
      const summoner = await resolveSummonerByRiotId(riot, player.platform, player.gameName, player.tagLine);
      if (!summoner) {
        totals.notFound += 1;
        log(`  ${name}: not found at Riot on ${player.platform} (renamed or moved), skipping`);
        consecutiveFailures = 0;
        continue;
      }
      name = riotIdLabel(summoner);
      const result = await ingestSummoner(db, riot, summoner, progressLogger(name, log), {
        shouldStop: () => stopRequested,
        onSkip: skipLogger(name, laneLog),
        onBadMatch: badMatchLogger(name, laneLog),
      });
      totals.ingested += result.ingested;
      totals.discovered += result.discovered;
      if (result.stopped) {
        log(`  ${name}: stopped early`);
        return;
      }
      totals.crawled += 1;
      consecutiveFailures = 0;
      outageSleepMs = OUTAGE_SLEEP_MS;
      const skipped =
        (result.skipped > 0 ? `, ${result.skipped} failed match(es) skipped` : "") +
        (result.bad > 0 ? `, ${result.bad} bad match(es)` : "");
      log(`  ${name}: done, ${result.ingested} match(es) stored${skipped}, ${result.discovered} new player(s)`);
      const minutes = (Date.now() - startedAt) / 60_000;
      log(
        `  run: ${totals.crawled} player(s) refreshed, ${totals.upToDate} already up to date, ${totals.notFound} not found,` +
          ` ${totals.ingested} new match(es), ${totals.discovered} new player(s) in ${minutes.toFixed(1)} min`,
      );
    } catch (err) {
      if (isFatal(err)) {
        laneLog.error(
          `fatal Riot error, every player would fail the same way (check the gateway's RIOT_API_KEY, and RIOT_GATEWAY_SECRET): ${errorMessage(err)}. Retrying in ${FATAL_SLEEP_MS / 60_000} min`,
        );
        leaderboard.putBack(lane, player);
        await sleep(FATAL_SLEEP_MS);
        continue;
      }
      totals.failed += 1;
      consecutiveFailures += 1;
      laneLog.error(`${name} failed, skipping them: ${errorMessage(err)}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        laneLog.error(
          `${consecutiveFailures} players failed in a row, looks like an outage (network, database or Riot); nothing was half-written. Waiting ${Math.round(outageSleepMs / 60_000)} min`,
        );
        await sleep(outageSleepMs);
        outageSleepMs = Math.min(outageSleepMs * 2, OUTAGE_SLEEP_MAX_MS);
        consecutiveFailures = 0;
      }
    }
  }
}

async function main() {
  scriptLog.info(
    `starting from rank ${startRank} of the global leaderboard` +
      `${Number.isFinite(maxPlayers) ? `, stops after ~${maxPlayers} player(s) refreshed` : ""}, lanes: ${LANES.join(", ")}`,
  );
  const leaderboard = new Leaderboard();
  await Promise.all(LANES.map((lane) => crawlLane(lane, leaderboard)));
  scriptLog.info(
    `done: ${totals.crawled} player(s) refreshed, ${totals.upToDate} already up to date, ${totals.notFound} not found at Riot,` +
      ` ${totals.ingested} match(es) stored, ${totals.skipped} failed match(es) skipped, ${totals.bad} bad match(es) found,` +
      ` ${totals.discovered} player(s) discovered, ${totals.failed} failed`,
  );
  await db.$client.end();
}

main().catch(async (err) => {
  scriptLog.error(`aborted: ${errorMessage(err)}`);
  await db.$client.end().catch(() => {});
  process.exit(1);
});
