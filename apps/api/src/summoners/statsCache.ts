import type { Summoner } from "@arena/db";
import { env } from "../env.js";
import { logger, riotIdLabel } from "../logger.js";
import { buildSummonerStats } from "./stats/buildSummonerStats.js";
import { getMatchSummary } from "./summonerRepository.js";

/** A refresh is offered again this long after the last one, so a recap is
 * only worth keeping until then (the refresh button would replace it). */
export const REFRESH_COOLDOWN_MS = 15 * 60_000;
const SWEEP_EVERY_MS = 60_000;

const log = logger.child({ module: "stats" });

interface Entry {
  /** `getMatchSummary` when built: the entry is stale once it moves. */
  key: string;
  /** The response, already serialized: a hit costs no stringify. */
  json: string;
  expiresAt: number;
}

/**
 * Built recaps, as JSON, for summoners whose matches were fetched in the last
 * 15 minutes: the window in which the page is most likely to be opened again
 * (the refresh stream builds it, a friend opens the shared link). Older ones
 * are built on each visit. Entries leave when that window closes (a sweep
 * every minute) or when a new game changes the summoner's recap, and the
 * whole cache stays under `STATS_CACHE_MAX_MB` (the entries closest to
 * expiring go first). Concurrent requests for the same recap share one build.
 */
class StatsCache {
  private entries = new Map<string, Entry>();
  private building = new Map<string, { key: string; json: Promise<string> }>();
  private bytes = 0;

  constructor(private readonly maxBytes: number) {
    setInterval(() => this.sweep(), SWEEP_EVERY_MS).unref();
  }

  /** The summoner's recap as a JSON string, from cache when still valid. */
  async get(summoner: Summoner): Promise<string> {
    const { matchCount, lastGameAt } = await getMatchSummary(summoner.puuid);
    const key = `${matchCount}:${lastGameAt ?? ""}`;
    const expiresAt = (summoner.lastRefreshedAt?.getTime() ?? 0) + REFRESH_COOLDOWN_MS;

    const entry = this.entries.get(summoner.puuid);
    if (entry?.key === key && expiresAt > Date.now()) {
      // A refresh that found no new game keeps the recap and extends its stay.
      entry.expiresAt = Math.max(entry.expiresAt, expiresAt);
      log.debug({ summoner: riotIdLabel(summoner) }, "cache hit");
      return entry.json;
    }

    const pending = this.building.get(summoner.puuid);
    if (pending?.key === key) return pending.json;

    const json = this.build(summoner, key, matchCount, expiresAt);
    this.building.set(summoner.puuid, { key, json });
    try {
      return await json;
    } finally {
      if (this.building.get(summoner.puuid)?.json === json) this.building.delete(summoner.puuid);
    }
  }

  private async build(summoner: Summoner, key: string, matchCount: number, expiresAt: number) {
    const startedAt = performance.now();
    const json = JSON.stringify(await buildSummonerStats(summoner));
    const cached = expiresAt > Date.now();
    this.remove(summoner.puuid);
    if (cached) this.store(summoner.puuid, { key, json, expiresAt });
    log.info(
      {
        summoner: riotIdLabel(summoner),
        matches: matchCount,
        ms: Math.round(performance.now() - startedAt),
        kb: Math.round(json.length / 1024),
        cachedFor: cached ? `${Math.round((expiresAt - Date.now()) / 60_000)}min` : "not cached (refreshed over 15 min ago)",
      },
      "recap built",
    );
    return json;
  }

  private store(puuid: string, entry: Entry) {
    this.entries.set(puuid, entry);
    this.bytes += entry.json.length;
    if (this.bytes <= this.maxBytes) return;
    // Over the ceiling: drop the entries that would expire soonest.
    const byExpiry = [...this.entries].sort((a, b) => a[1].expiresAt - b[1].expiresAt);
    for (const [otherPuuid] of byExpiry) {
      if (this.bytes <= this.maxBytes) break;
      if (otherPuuid !== puuid) this.remove(otherPuuid);
    }
    log.warn({ entries: this.entries.size, mb: Math.round(this.bytes / 1024 ** 2) }, "cache over its size limit, evicted the oldest recaps");
  }

  private remove(puuid: string) {
    const entry = this.entries.get(puuid);
    if (!entry) return;
    this.entries.delete(puuid);
    this.bytes -= entry.json.length;
  }

  private sweep() {
    const now = Date.now();
    let removed = 0;
    for (const [puuid, entry] of this.entries) {
      if (entry.expiresAt > now) continue;
      this.remove(puuid);
      removed += 1;
    }
    if (removed > 0) {
      log.info({ removed, entries: this.entries.size, mb: +(this.bytes / 1024 ** 2).toFixed(1) }, "expired recaps dropped");
    }
  }
}

/** Sizes are counted in string length: bytes for mostly-ASCII JSON, a rough
 * floor when Riot IDs use other scripts. */
export const statsCache = new StatsCache(env.STATS_CACHE_MAX_MB * 1024 ** 2);
