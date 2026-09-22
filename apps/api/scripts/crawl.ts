/**
 * Crawler: grows the database by walking from player to player.
 *
 * Each step takes the summoner with the oldest `lastRefreshedAt` (never
 * refreshed first), refreshes their Riot ID/icon/level from account-v1 and
 * summoner-v4, ingests their new Arena matches, and adds every player
 * met in those matches to `summoners` — who then queue up for their own
 * turn. Matches shared between players are stored once (see
 * `ingestSummoner`), so a match is never fetched twice.
 *
 * Run by hand; it never stops on its own unless given --summoners. Ctrl-C
 * finishes the current match and exits (the interrupted summoner resumes
 * next run); a second Ctrl-C exits immediately.
 *
 * Runs in its own process with its own rate limiter. Running it next to
 * the API server shares the key's per-region budget: each process's limiter
 * adopts the counts Riot reports, so they slow down rather than hit 429s.
 *
 * Usage: pnpm --filter @arena/api crawl [--summoners N]
 */
import { parseArgs } from "node:util";
import { asc, decompressJson, desc, eq, inArray, matches, sql, summoners } from "@arena/db";
import type { RiotArenaMatchDto } from "@arena/types";
import { db } from "../src/db.js";
import { riot, RiotApiError } from "../src/riotApi/index.js";
import { ingestSummoner, type IngestProgress } from "../src/ingestion/ingestSummoner.js";

const { values: args } = parseArgs({
  options: { summoners: { type: "string" } },
});
const maxSummoners = args.summoners ? Number(args.summoners) : Infinity;
if (!(maxSummoners > 0)) throw new Error("--summoners must be a positive number");

const MAX_CONSECUTIVE_FAILURES = 5;

let stopRequested = false;
process.on("SIGINT", () => {
  if (stopRequested) process.exit(130);
  stopRequested = true;
  console.log("\n[crawl] stopping after the current match (Ctrl-C again to quit now)");
});

/**
 * Adds players from matches stored before discovery existed (or by an older
 * ingest) to `summoners`. Only matches with a participant missing from
 * `summoners` are decompressed, so after the first run this is one query.
 */
async function discoverFromStoredMatches() {
  const rows = await db.execute<{ match_id: string }>(sql`
    select distinct mp.match_id
    from match_participants mp
    where not exists (select 1 from summoners s where s.puuid = mp.puuid)
  `);
  const matchIds = rows.map((row) => row.match_id);
  if (matchIds.length === 0) return 0;
  console.log(`[crawl] seeding: ${matchIds.length} stored match(es) have players not in summoners yet`);

  let discovered = 0;
  for (let i = 0; i < matchIds.length; i += 50) {
    const batch = await db
      .select({ region: matches.region, raw: matches.raw })
      .from(matches)
      .where(inArray(matches.matchId, matchIds.slice(i, i + 50)))
      // Newest first, so a player met in several matches gets the Riot ID
      // and icon they had most recently.
      .orderBy(desc(matches.gameCreation));
    for (const match of batch) {
      const dto = decompressJson<RiotArenaMatchDto>(match.raw);
      const players = dto.info.participants
        .filter((p) => p.riotIdGameName && p.riotIdTagline)
        .map((p) => ({
          puuid: p.puuid,
          riotIdGameName: p.riotIdGameName,
          riotIdTagline: p.riotIdTagline,
          region: match.region,
          profileIconId: p.profileIcon ?? null,
          summonerLevel: p.summonerLevel ?? null,
        }));
      if (players.length === 0) continue;
      const inserted = await db
        .insert(summoners)
        .values(players)
        .onConflictDoNothing({ target: summoners.puuid })
        .returning({ puuid: summoners.puuid });
      discovered += inserted.length;
    }
    const scanned = Math.min(i + 50, matchIds.length);
    console.log(`[crawl] seeding: ${scanned}/${matchIds.length} matches scanned, ${discovered} player(s) added`);
  }
  return discovered;
}

/** The next summoner to crawl, skipping ones that already failed this run. */
async function nextSummoner(skip: ReadonlySet<string>) {
  const candidates = await db
    .select({
      puuid: summoners.puuid,
      region: summoners.region,
      name: sql<string>`${summoners.riotIdGameName} || '#' || ${summoners.riotIdTagline}`,
      lastRefreshedAt: summoners.lastRefreshedAt,
    })
    .from(summoners)
    .orderBy(sql`${summoners.lastRefreshedAt} asc nulls first`, asc(summoners.puuid))
    .limit(skip.size + 1);
  return candidates.find((candidate) => !skip.has(candidate.puuid));
}

/**
 * Updates a summoner's Riot ID, icon and level from account-v1 and
 * summoner-v4 (2 calls). Discovered rows hold whatever the match they were
 * met in said, which can predate a rename. Returns the current "name#tag".
 * A failure here is logged, not thrown: the matches are still worth
 * fetching with a stale name. Fatal errors (key, PUUID app) still throw.
 */
async function refreshProfile(summoner: { puuid: string; region: string; name: string }) {
  try {
    const account = await riot.account.getAccountByPuuid(summoner.puuid, summoner.region);
    const profile = await riot.summoner.getSummonerByPuuid(summoner.puuid, summoner.region);
    const next = {
      riotIdGameName: account.gameName,
      riotIdTagline: account.tagLine,
      profileIconId: profile.profileIconId,
      summonerLevel: profile.summonerLevel,
    };
    await db.update(summoners).set(next).where(eq(summoners.puuid, summoner.puuid));
    const name = `${account.gameName}#${account.tagLine}`;
    if (name !== summoner.name) console.log(`[crawl]   ${summoner.name} is now ${name}`);
    return name;
  } catch (err) {
    if (isFatal(err)) throw err;
    console.warn(
      `[crawl]   ${summoner.name}: profile refresh failed, keeping the stored one:`,
      err instanceof Error ? err.message : err,
    );
    return summoner.name;
  }
}

/** Errors that will fail every summoner the same way — no point going on. */
function isFatal(err: unknown) {
  // 401/403: missing or expired key. 400 "decrypting": PUUIDs from another
  // Riot app (see CLAUDE.md §2, remap-puuids).
  return err instanceof RiotApiError && err.fatal;
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

/** Logs a refresh's progress: the match count once ids are in, then every match. */
function progressLogger(name: string) {
  let startedAt = 0;
  return (progress: IngestProgress) => {
    if (progress.phase === "matchIds") {
      console.log(`[crawl]   ${name}: fetching match ids`);
      return;
    }
    if (progress.done === 0) {
      startedAt = Date.now();
      console.log(`[crawl]   ${name}: ${progress.total} new match(es) to fetch`);
      return;
    }
    const perMatchMs = (Date.now() - startedAt) / progress.done;
    const etaMin = ((progress.total - progress.done) * perMatchMs) / 60_000;
    console.log(
      `[crawl]   ${name}: match ${progress.done}/${progress.total} stored (~${etaMin.toFixed(1)} min left)`,
    );
  };
}

async function main() {
  console.log(
    `[crawl] starting${Number.isFinite(maxSummoners) ? ` (stops after ${maxSummoners} summoner(s))` : ""} — Ctrl-C to stop`,
  );
  const seeded = await discoverFromStoredMatches();
  if (seeded > 0) console.log(`[crawl] added ${seeded} player(s) from already-stored matches`);

  const failed = new Set<string>();
  // Several summoners failing in a row means the network, the database or
  // Riot is down, not that those players are broken: stop instead of
  // marking the whole queue as failed. Nothing is lost — see ingestSummoner.
  let consecutiveFailures = 0;
  let crawled = 0;
  let totalIngested = 0;
  let totalDiscovered = 0;
  const startedAt = Date.now();

  while (!stopRequested && crawled < maxSummoners) {
    const summoner = await nextSummoner(failed);
    if (!summoner) {
      console.log("[crawl] no summoners left to crawl");
      break;
    }

    const last = summoner.lastRefreshedAt ? summoner.lastRefreshedAt.toISOString() : "never";
    console.log(`[crawl] ${summoner.name} (${summoner.region}, last refreshed ${last})`);
    try {
      summoner.name = await refreshProfile(summoner);
      const result = await ingestSummoner(db, riot, summoner, progressLogger(summoner.name), {
        shouldStop: () => stopRequested,
      });
      totalIngested += result.ingested;
      totalDiscovered += result.discovered;
      if (result.stopped) {
        console.log(`[crawl]   ${summoner.name}: stopped early, resumes on the next run`);
        break;
      }
      crawled += 1;
      consecutiveFailures = 0;
      console.log(
        `[crawl]   ${summoner.name}: done, ${result.ingested} match(es) stored, ${result.discovered} new player(s)`,
      );
    } catch (err) {
      if (isFatal(err)) throw err;
      failed.add(summoner.puuid);
      consecutiveFailures += 1;
      console.error(`[crawl] ${summoner.name} failed, skipping for this run:`, err instanceof Error ? err.message : err);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        throw new Error(
          `${consecutiveFailures} summoners failed in a row — looks like an outage (network, database or Riot). Rerun when it's back; nothing was half-written.`,
        );
      }
      continue;
    }

    const totals = await counts();
    const minutes = (Date.now() - startedAt) / 60_000;
    console.log(
      `[crawl]   run: ${crawled} summoner(s), ${totalIngested} new match(es), ${totalDiscovered} new player(s) in ${minutes.toFixed(1)} min` +
        ` · db: ${totals.matches} matches, ${totals.summoners} summoners (${totals.pending} never refreshed)`,
    );
  }

  console.log(
    `[crawl] done: ${crawled} summoner(s) refreshed, ${totalIngested} match(es) stored, ${totalDiscovered} player(s) discovered, ${failed.size} failed`,
  );
  await db.$client.end();
}

main().catch(async (err) => {
  console.error("[crawl] aborted:", err instanceof Error ? err.message : err);
  await db.$client.end().catch(() => {});
  process.exit(1);
});
