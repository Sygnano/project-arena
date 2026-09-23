import {
  eq,
  inArray,
  matches,
  matchParticipants,
  matchRounds,
  parseMatch,
  parseRounds,
  riotIdColumns,
  skippedMatches,
  sql,
  summoners,
  type Db,
} from "@arena/db";
import type { RiotArenaMatchDto } from "@arena/types";
import type { RiotClient } from "../riotApi/client.js";
import { RiotApiError } from "../riotApi/errors.js";
import { Queue } from "../riotApi/queues.js";
import { platformOfMatch, type Platform } from "../riotApi/routing.js";

export type IngestProgress =
  | { phase: "matchIds" }
  /** `done` counts stored and skipped matches alike. */
  | { phase: "matches"; done: number; total: number };

/** Where a bad match gave out: its Riot fetch, its timeline's, parsing, or storing. */
export type SkipStage = "match" | "timeline" | "parse" | "store";

/** A match left out of the database because the match itself is bad (see `skippedMatches`). */
export interface SkippedMatch {
  matchId: string;
  stage: SkipStage;
  /** Riot's status, for the fetch stages. */
  riotStatus: number | null;
  error: string;
}

export interface IngestOptions {
  /** Checked between matches: returning true stops the refresh early,
   * WITHOUT stamping `lastRefreshedAt`, so the next run resumes it (matches
   * already stored are skipped). Used by the crawler's Ctrl-C handling. */
  shouldStop?: () => boolean;
  /** Called for each bad match, after it's recorded in `skipped_matches`. */
  onSkip?: (skip: SkippedMatch) => void;
  /** Ask Riot for the summoner's whole Arena history instead of only games
   * since their last refresh, so a gap left further back (a match skipped
   * or not yet published back then) is found too. Costs one extra call per
   * 100 games. Used by `scripts/check-recaps.ts`. */
  fullHistory?: boolean;
}

// A refresh only asks Riot for games that started after the previous
// refresh, minus this margin: a game still being played (or not yet
// published by Riot) when the last refresh ran started before its stamp.
// Arena games last well under an hour.
const REFRESH_OVERLAP_MS = 2 * 60 * 60_000;

/** The innermost cause's message: for a store failure, Postgres's reason
 * rather than Drizzle's wrapper, which quotes the whole insert and its values. */
function rootMessage(err: unknown): string {
  let current = err;
  while (current instanceof Error && current.cause instanceof Error) current = current.cause;
  return current instanceof Error ? current.message : String(current);
}

/** The match itself is bad: skip it rather than fail the whole refresh. */
class BadMatchError extends Error {
  constructor(
    readonly stage: SkipStage,
    readonly riotStatus: number | null,
    cause: unknown,
  ) {
    super(rootMessage(cause), { cause });
  }
}

/** Riot's final answer about this match: a 4xx other than 429. Fatal ones
 * (key, foreign PUUID) aren't about the match, and 429s, 5xx and network
 * errors that outlasted the retries are an outage, not a bad match. */
function isRiotRefusal(err: unknown): err is RiotApiError {
  return err instanceof RiotApiError && !err.fatal && err.status >= 400 && err.status < 500 && err.status !== 429;
}

/** Postgres rejected the rows themselves (SQLSTATE class 22, data exception,
 * or 23, integrity violation), as opposed to being unreachable. Drizzle
 * wraps the driver's error, so the code can sit on a `cause`. */
function isRejectedData(err: unknown) {
  for (let current: unknown = err; current instanceof Error; current = current.cause) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && /^2[23]/.test(code)) return true;
  }
  return false;
}

/** Runs one step of a match's ingestion, turning a failure that's the
 * match's fault into a `BadMatchError`. Anything else is rethrown as is. */
async function step<T>(stage: SkipStage, run: () => Promise<T> | T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (stage === "match" || stage === "timeline") {
      if (isRiotRefusal(err)) throw new BadMatchError(stage, err.status, err);
    } else if (stage === "parse" || isRejectedData(err)) {
      throw new BadMatchError(stage, null, err);
    }
    throw err;
  }
}

/** `summoners` rows for everyone in this match, as of this match, on the
 * platform the match was played on. */
function participantSummoners(dto: RiotArenaMatchDto, region: string) {
  return dto.info.participants
    .filter((p) => p.riotIdGameName && p.riotIdTagline)
    .map((p) => ({
      puuid: p.puuid,
      ...riotIdColumns(p.riotIdGameName, p.riotIdTagline),
      region,
      profileIconId: p.profileIcon ?? null,
      summonerLevel: p.summonerLevel ?? null,
    }));
}

/**
 * Fetches, parses and stores one match, all or nothing. Returns how many of
 * its players were new to `summoners`. Throws `BadMatchError` when the match
 * itself is bad, anything else when something is down.
 */
async function ingestMatch(db: Db, riot: RiotClient, matchId: string) {
  // The match's own platform, not the summoner's: their history lists
  // their games on every platform of the cluster (an ME1 player's EUW1
  // games too), and everyone met in an EUW1 game is on EUW1. A prefix we
  // don't route (a platform Riot added or retired) makes the match
  // unfetchable, which is the match's problem, not the refresh's.
  let platform: Platform;
  try {
    platform = platformOfMatch(matchId);
  } catch (err) {
    throw new BadMatchError("match", null, err);
  }
  const dto = await step("match", () => riot.match.getMatch(matchId));
  const timelineDto = await step("timeline", () => riot.match.getMatchTimeline(matchId));
  const parsed = await step("parse", () => {
    return {
      ...parseMatch(matchId, platform, dto, timelineDto),
      rounds: parseRounds(matchId, dto, timelineDto),
      players: participantSummoners(dto, platform),
    };
  });

  return step("store", () =>
    db.transaction(async (tx) => {
      await tx.insert(matches).values(parsed.match).onConflictDoNothing({ target: matches.matchId });
      await tx.insert(matchParticipants).values(parsed.participants).onConflictDoNothing();
      if (parsed.rounds.length > 0) await tx.insert(matchRounds).values(parsed.rounds).onConflictDoNothing();
      // Skipped by an earlier refresh, fine now.
      await tx.delete(skippedMatches).where(eq(skippedMatches.matchId, matchId));
      if (parsed.players.length === 0) return 0;
      const inserted = await tx
        .insert(summoners)
        .values(parsed.players)
        .onConflictDoNothing({ target: summoners.puuid })
        .returning({ puuid: summoners.puuid });
      return inserted.length;
    }),
  );
}

/** Logs a bad match in `skipped_matches`: one row per match, counting repeats. */
async function recordSkip(db: Db, skip: SkippedMatch, seenInPuuid: string) {
  const fields = { stage: skip.stage, riotStatus: skip.riotStatus, error: skip.error, seenInPuuid };
  await db
    .insert(skippedMatches)
    .values({ matchId: skip.matchId, platform: skip.matchId.split("_")[0]!.toLowerCase(), ...fields })
    .onConflictDoUpdate({
      target: skippedMatches.matchId,
      set: { ...fields, lastSkippedAt: sql`now()`, timesSkipped: sql`${skippedMatches.timesSkipped} + 1` },
    });
}

/**
 * Pulls new Arena matches for one summoner: fetches their match ids (only
 * since the last refresh, when there was one), skips ones already in the DB
 * — matches are shared between players, so each is stored once no matter
 * how many of its players get refreshed — fetches + parses the rest, and
 * inserts them.
 *
 * A bad match (Riot refuses it or its timeline, the parser throws, Postgres
 * rejects the rows) is left out entirely, logged in `skipped_matches` (and
 * through `onSkip`), and the refresh goes on: one broken match must not
 * block a summoner forever. An outage still fails the refresh.
 *
 * Every participant of a newly stored match is added to `summoners` if
 * they aren't there yet (with `lastRefreshedAt` null, i.e. "never
 * refreshed"), which is how the crawler discovers new players. Existing
 * rows are never overwritten from match data: a match's Riot ID can predate
 * a rename, and account-v1 is what keeps names current (the refresh stream's
 * lookup, and the crawler before each summoner). Stamps
 * `summoners.lastRefreshedAt` on success.
 *
 * Safe to call repeatedly — an interrupted refresh resumes where it stopped.
 */
export async function ingestSummoner(
  db: Db,
  riot: RiotClient,
  summoner: { puuid: string; region: string },
  onProgress?: (progress: IngestProgress) => void,
  options: IngestOptions = {},
) {
  const startedAt = new Date();
  const [previous] = await db
    .select({ lastRefreshedAt: summoners.lastRefreshedAt })
    .from(summoners)
    .where(eq(summoners.puuid, summoner.puuid));
  const since =
    previous?.lastRefreshedAt && !options.fullHistory
      ? new Date(previous.lastRefreshedAt.getTime() - REFRESH_OVERLAP_MS)
      : undefined;

  onProgress?.({ phase: "matchIds" });
  // Newest first.
  const recentMatchIds = await riot.match.getAllMatchIdsByPuuid(summoner.puuid, summoner.region, {
    queue: Queue.ARENA,
    startTime: since,
  });

  const existing =
    recentMatchIds.length === 0
      ? []
      : await db
          .select({ matchId: matches.matchId })
          .from(matches)
          .where(inArray(matches.matchId, recentMatchIds));
  const existingIds = new Set(existing.map((m) => m.matchId));

  const newMatchIds = recentMatchIds.filter((id) => !existingIds.has(id));

  let ingested = 0;
  let skipped = 0;
  let discovered = 0;
  const progress = () => onProgress?.({ phase: "matches", done: ingested + skipped, total: newMatchIds.length });
  progress();
  for (const matchId of newMatchIds) {
    if (options.shouldStop?.()) return { ingested, skipped, discovered, stopped: true };

    try {
      discovered += await ingestMatch(db, riot, matchId);
      ingested += 1;
    } catch (err) {
      if (!(err instanceof BadMatchError)) throw err;
      const skip: SkippedMatch = { matchId, stage: err.stage, riotStatus: err.riotStatus, error: err.message };
      await recordSkip(db, skip, summoner.puuid);
      options.onSkip?.(skip);
      skipped += 1;
    }
    progress();
  }

  await db
    .update(summoners)
    // The refresh's start, not its end: games that began while it ran are
    // picked up next time (plus REFRESH_OVERLAP_MS on top).
    .set({ lastRefreshedAt: startedAt })
    .where(eq(summoners.puuid, summoner.puuid));

  return { ingested, skipped, discovered, stopped: false };
}
