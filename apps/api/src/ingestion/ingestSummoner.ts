import {
  badMatches,
  compressJson,
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
import { Queue, RiotApiError, platformOfMatch, type Platform, type RiotClient } from "@arena/riot";
import type { RiotArenaMatchDto } from "@arena/types";

export type IngestProgress =
  | { phase: "matchIds" }
  /** `done` counts stored, skipped and bad matches alike, and ones another
   * process stored while this refresh ran. */
  | { phase: "matches"; done: number; total: number };

/** Where a failed match gave out: its Riot fetch, its timeline's, parsing, or storing. */
export type SkipStage = "match" | "timeline" | "parse" | "store";

/** A match that failed to store this time and will be fetched again (see `skippedMatches`). */
export interface SkippedMatch {
  matchId: string;
  stage: SkipStage;
  /** Riot's status, for the fetch stages. */
  riotStatus: number | null;
  error: string;
}

/** A match Riot says didn't end normally, never fetched again (see `badMatches`). */
export interface BadMatch {
  matchId: string;
  endOfGameResult: string;
}

export interface IngestOptions {
  /** Checked between matches: returning true stops the refresh early,
   * WITHOUT stamping `lastRefreshedAt`, so the next run resumes it (matches
   * already stored are skipped). Used by the crawler's Ctrl-C handling. */
  shouldStop?: () => boolean;
  /** Called for each failed match, after it's recorded in `skipped_matches`. */
  onSkip?: (skip: SkippedMatch) => void;
  /** Called for each bad match met for the first time, after it's recorded in `bad_matches`. */
  onBadMatch?: (bad: BadMatch) => void;
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

/** What Riot says about every match that ended normally (all stored ones). */
const GAME_COMPLETE = "GameComplete";

/** The match failed to store: skip it this time rather than fail the whole refresh. */
class FailedMatchError extends Error {
  constructor(
    readonly stage: SkipStage,
    readonly riotStatus: number | null,
    cause: unknown,
  ) {
    super(rootMessage(cause), { cause });
  }
}

/** Riot says the match didn't end normally: never worth fetching again. */
class BadMatchError extends Error {
  constructor(readonly endOfGameResult: string) {
    super(`game didn't end normally (endOfGameResult: ${endOfGameResult})`);
  }
}

/** Riot's final answer about this match: a 4xx other than 429. Fatal ones
 * (key, foreign PUUID) aren't about the match, and 429s, 5xx and network
 * errors that outlasted the retries are an outage, not a failed match. */
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
 * match's fault into a `FailedMatchError`. Anything else is rethrown as is. */
async function step<T>(stage: SkipStage, run: () => Promise<T> | T): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (stage === "match" || stage === "timeline") {
      if (isRiotRefusal(err)) throw new FailedMatchError(stage, err.status, err);
    } else if (stage === "parse" || isRejectedData(err)) {
      throw new FailedMatchError(stage, null, err);
    }
    throw err;
  }
}

/** `summoners` rows for everyone in this match, as of this match, on the
 * platform the match was played on. Sorted by puuid: two processes storing
 * two matches of the same new players (a premade) lock their rows in the
 * insert's order, and in opposite orders they'd deadlock. */
function participantSummoners(dto: RiotArenaMatchDto, region: string) {
  return dto.info.participants
    .filter((p) => p.riotIdGameName && p.riotIdTagline)
    .map((p) => ({
      puuid: p.puuid,
      ...riotIdColumns(p.riotIdGameName, p.riotIdTagline),
      region,
      profileIconId: p.profileIcon ?? null,
      summonerLevel: p.summonerLevel ?? null,
    }))
    .sort((a, b) => (a.puuid < b.puuid ? -1 : a.puuid > b.puuid ? 1 : 0));
}

/**
 * Fetches, parses and stores one match, all or nothing. Returns how many of
 * its players were new to `summoners`. Throws `BadMatchError` when Riot says
 * the game didn't end normally, `FailedMatchError` when this match failed
 * to store, anything else when something is down.
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
    throw new FailedMatchError("match", null, err);
  }
  const dto = await step("match", () => riot.match.getMatch(matchId));
  // An aborted lobby ("Abort_Unexpected", ...) comes with no players, and
  // every player of that lobby has it in their history. Checked before the
  // timeline, which it doesn't need. A missing field isn't a verdict.
  const { endOfGameResult } = dto.info;
  if (endOfGameResult !== undefined && endOfGameResult !== GAME_COMPLETE) throw new BadMatchError(endOfGameResult);
  const timelineDto = await step("timeline", () => riot.match.getMatchTimeline(matchId));
  const parsed = await step("parse", async () => {
    // A complete game without players is unexpected: retried like any failure.
    if (dto.info.participants.length === 0) {
      throw new Error(`no participants (endOfGameResult: ${dto.info.endOfGameResult ?? "missing"})`);
    }
    const { match, participants } = parseMatch(matchId, platform, dto, timelineDto);
    // Side by side, off the main thread (about 25 ms for a timeline).
    const [raw, timeline] = await Promise.all([compressJson(dto), compressJson(timelineDto)]);
    return {
      match: { ...match, raw, timeline },
      participants,
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

/** Records a bad match in `bad_matches`, which keeps it from being fetched
 * again. False when it was already there (another process met it first). */
async function recordBadMatch(db: Db, bad: BadMatch, seenInPuuid: string) {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(badMatches)
      .values({ ...bad, platform: bad.matchId.split("_")[0]!.toLowerCase(), seenInPuuid })
      .onConflictDoNothing({ target: badMatches.matchId })
      .returning({ matchId: badMatches.matchId });
    // Logged as a failure by an older build.
    await tx.delete(skippedMatches).where(eq(skippedMatches.matchId, bad.matchId));
    return inserted.length > 0;
  });
}

/** Which of these matches are stored, or bad (never worth another call).
 * Failed ones aren't: they're fetched again. */
async function knownMatchIds(db: Db, matchIds: string[]) {
  if (matchIds.length === 0) return new Set<string>();
  const known = await db
    .select({ matchId: matches.matchId })
    .from(matches)
    .where(inArray(matches.matchId, matchIds))
    .union(db.select({ matchId: badMatches.matchId }).from(badMatches).where(inArray(badMatches.matchId, matchIds)));
  return new Set(known.map((m) => m.matchId));
}

/** Logs a failed match in `skipped_matches`: one row per match, counting repeats. */
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

/** What became of one match (`fetchMatch`). */
export type MatchOutcome =
  | { kind: "stored"; discovered: number }
  /** Stored or found bad by someone else already: no Riot call made. */
  | { kind: "known" }
  /** `firstSeen`: false when another process recorded it first. */
  | { kind: "bad"; badMatch: BadMatch; firstSeen: boolean }
  | { kind: "failed"; skip: SkippedMatch };

/**
 * Fetches and stores one match, unless it's already stored or bad (looked up
 * right before its 2 Riot calls: another process may have stored it since
 * the caller's list was made). A bad match goes to `bad_matches`, a failed
 * one to `skipped_matches` (`seenInPuuid`: whose history listed it). Throws
 * on an outage (network, Riot 5xx/429 after retries, database) and on fatal
 * Riot errors.
 */
export async function fetchMatch(
  db: Db,
  riot: RiotClient,
  matchId: string,
  seenInPuuid: string,
): Promise<MatchOutcome> {
  if ((await knownMatchIds(db, [matchId])).size > 0) {
    // A failure recorded while another process was storing it.
    await db.delete(skippedMatches).where(eq(skippedMatches.matchId, matchId));
    return { kind: "known" };
  }
  try {
    return { kind: "stored", discovered: await ingestMatch(db, riot, matchId) };
  } catch (err) {
    if (err instanceof BadMatchError) {
      const badMatch: BadMatch = { matchId, endOfGameResult: err.endOfGameResult };
      return { kind: "bad", badMatch, firstSeen: await recordBadMatch(db, badMatch, seenInPuuid) };
    }
    if (err instanceof FailedMatchError) {
      const skip: SkippedMatch = { matchId, stage: err.stage, riotStatus: err.riotStatus, error: err.message };
      await recordSkip(db, skip, seenInPuuid);
      return { kind: "failed", skip };
    }
    throw err;
  }
}

// A parser bug or a change in Riot's format fails every match the same way,
// and skipping them all would still count the refresh as done: the summoner
// would be stamped refreshed with those matches missing, beyond what their
// next refresh looks at. This many in a row, at parse or store with the
// same error, fail the refresh instead.
const REPEATED_FAILURE_LIMIT = 5;

/** Several matches in a row failed the same way: the fault is ours or Riot's format, not theirs. */
export class RepeatedFailureError extends Error {
  constructor(readonly skip: SkippedMatch) {
    super(
      `${REPEATED_FAILURE_LIMIT} matches in a row failed at ${skip.stage} with the same error, ` +
        `likely a bug or a Riot format change rather than the matches: ${skip.error}`,
    );
  }
}

/** Watches a run of `fetchMatch` outcomes and throws `RepeatedFailureError`
 * at the REPEATED_FAILURE_LIMIT-th same parse/store failure in a row. */
export class FailureBreaker {
  private lastFailure: string | undefined;
  private count = 0;

  record(outcome: MatchOutcome) {
    // Says nothing either way: no fetch was made.
    if (outcome.kind === "known") return;
    if (outcome.kind !== "failed" || (outcome.skip.stage !== "parse" && outcome.skip.stage !== "store")) {
      this.lastFailure = undefined;
      this.count = 0;
      return;
    }
    const failure = `${outcome.skip.stage}\n${outcome.skip.error}`;
    this.count = failure === this.lastFailure ? this.count + 1 : 1;
    this.lastFailure = failure;
    if (this.count >= REPEATED_FAILURE_LIMIT) throw new RepeatedFailureError(outcome.skip);
  }
}

/**
 * Pulls new Arena matches for one summoner: fetches their match ids (only
 * since the last refresh, when there was one), skips ones already in the DB
 * — matches are shared between players, so each is stored once no matter
 * how many of its players get refreshed — and known bad ones, fetches +
 * parses the rest, and inserts them.
 *
 * A bad match (Riot says the game didn't end normally, e.g. an aborted
 * lobby) goes to `bad_matches` (and through `onBadMatch`) and is never
 * fetched again. A failed match (Riot refuses it or its timeline, the parser
 * throws, Postgres rejects the rows) is left out, logged in
 * `skipped_matches` (and through `onSkip`), and fetched again by the next
 * refresh that meets it or by `scripts/retry-skipped.ts`. Either way the
 * refresh goes on: one broken match must not block a summoner forever. An
 * outage still fails the refresh, and so do several matches in a row
 * failing the same way (`RepeatedFailureError`), without stamping it.
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

  const knownIds = await knownMatchIds(db, recentMatchIds);
  const newMatchIds = recentMatchIds.filter((id) => !knownIds.has(id));

  let ingested = 0;
  let skipped = 0;
  let bad = 0;
  let discovered = 0;
  // Stored (or found bad) by another process since the list above was built:
  // a first fetch runs for a long time, and a teammate's history holds the
  // same matches.
  let storedMeanwhile = 0;
  const progress = () =>
    onProgress?.({ phase: "matches", done: ingested + skipped + bad + storedMeanwhile, total: newMatchIds.length });
  const breaker = new FailureBreaker();
  progress();
  for (const matchId of newMatchIds) {
    if (options.shouldStop?.()) return { ingested, skipped, bad, discovered, stopped: true };

    const outcome = await fetchMatch(db, riot, matchId, summoner.puuid);
    if (outcome.kind === "stored") {
      discovered += outcome.discovered;
      ingested += 1;
    } else if (outcome.kind === "known") {
      storedMeanwhile += 1;
    } else if (outcome.kind === "bad") {
      if (outcome.firstSeen) options.onBadMatch?.(outcome.badMatch);
      bad += 1;
    } else {
      options.onSkip?.(outcome.skip);
      skipped += 1;
    }
    breaker.record(outcome);
    progress();
  }

  await db
    .update(summoners)
    // The refresh's start, not its end: games that began while it ran are
    // picked up next time (plus REFRESH_OVERLAP_MS on top).
    .set({ lastRefreshedAt: startedAt })
    .where(eq(summoners.puuid, summoner.puuid));

  return { ingested, skipped, bad, discovered, stopped: false };
}
