import type { Summoner } from "@arena/db";
import { env } from "../env.js";
import { logger, riotIdLabel } from "../logger.js";
import { buildSummonerStats } from "./stats/buildSummonerStats.js";
import { getMatchSummary } from "./summonerRepository.js";

/** A refresh is offered again this long after the last one, so a recap is
 * only worth keeping until then (the refresh button would replace it). */
export const REFRESH_COOLDOWN_MS = 15 * 60_000;
const SWEEP_EVERY_MS = 60_000;
/** A recently viewed recap nobody has opened for this long leaves. */
const RECENT_IDLE_MS = 60 * 60_000;

const log = logger.child({ module: "stats" });

interface Entry {
  /** `getMatchSummary` when built: the entry is stale once it moves. */
  key: string;
  /** The response, already serialized: a hit costs no stringify. */
  json: string;
  /** Its size in memory (see `sizeInMemory`). */
  bytes: number;
  /** Kept at least until then: 15 minutes after the summoner's last refresh. */
  freshUntil: number;
  lastUsedAt: number;
}

/** V8 stores a string with only Latin-1 characters at a byte per character
 * and any other at two, so a recap naming a Korean co-player costs double. */
function sizeInMemory(json: string) {
  return /[^\u0000-ÿ]/.test(json) ? json.length * 2 : json.length;
}

/**
 * Built recaps, as JSON, in two kinds (decided with the user):
 * - **fresh**: the summoner's matches were fetched in the last 15 minutes,
 *   the window in which the page is most likely to be opened again (the
 *   refresh stream builds it, a friend opens the shared link). Kept until
 *   that window closes.
 * - **recent**: any other recap someone opened, kept in least-recently-used
 *   order within `STATS_CACHE_RECENT_MB`, and for an hour at most after its
 *   last view. Without it, every view of an older recap was a full rebuild,
 *   an easy way to keep this process busy.
 * A fresh entry turns recent when its window closes. Any entry leaves as soon
 * as a new game changes the summoner's recap, and the whole cache stays under
 * `STATS_CACHE_MAX_MB` (recent entries go first, then the fresh ones closest
 * to expiring). Concurrent requests for the same recap share one build.
 */
class StatsCache {
  /** In least-recently-used order: a hit moves its entry to the end. */
  private entries = new Map<string, Entry>();
  private building = new Map<string, { key: string; json: Promise<string> }>();
  private bytes = 0;

  constructor(
    private readonly maxBytes: number,
    private readonly maxRecentBytes: number,
  ) {
    setInterval(() => this.sweep(), SWEEP_EVERY_MS).unref();
  }

  /** The summoner's recap as a JSON string, from cache when still valid. */
  async get(summoner: Summoner): Promise<string> {
    const { matchCount, lastGameAt } = await getMatchSummary(summoner.puuid);
    const key = `${matchCount}:${lastGameAt ?? ""}`;
    const freshUntil = (summoner.lastRefreshedAt?.getTime() ?? 0) + REFRESH_COOLDOWN_MS;

    const entry = this.entries.get(summoner.puuid);
    if (entry?.key === key) {
      // A refresh that found no new game keeps the recap and extends its stay.
      entry.freshUntil = Math.max(entry.freshUntil, freshUntil);
      entry.lastUsedAt = Date.now();
      this.entries.delete(summoner.puuid);
      this.entries.set(summoner.puuid, entry);
      log.debug({ summoner: riotIdLabel(summoner) }, "cache hit");
      return entry.json;
    }

    const pending = this.building.get(summoner.puuid);
    if (pending?.key === key) return pending.json;

    const json = this.build(summoner, key, matchCount, freshUntil);
    this.building.set(summoner.puuid, { key, json });
    try {
      return await json;
    } finally {
      if (this.building.get(summoner.puuid)?.json === json) this.building.delete(summoner.puuid);
    }
  }

  private async build(summoner: Summoner, key: string, matchCount: number, freshUntil: number) {
    const startedAt = performance.now();
    const json = JSON.stringify(await buildSummonerStats(summoner));
    const now = Date.now();
    this.remove(summoner.puuid);
    const entry: Entry = { key, json, bytes: sizeInMemory(json), freshUntil, lastUsedAt: now };
    const fresh = freshUntil > now;
    // One recap bigger than the whole budget it would sit in isn't kept.
    const cached = entry.bytes <= (fresh ? this.maxBytes : this.maxRecentBytes);
    if (cached) this.store(summoner.puuid, entry);
    log.info(
      {
        summoner: riotIdLabel(summoner),
        matches: matchCount,
        ms: Math.round(performance.now() - startedAt),
        kb: Math.round(entry.bytes / 1024),
        cachedAs: !cached ? "not cached (too big)" : fresh ? `fresh, ${Math.round((freshUntil - now) / 60_000)}min` : "recent",
      },
      "recap built",
    );
    return json;
  }

  private store(puuid: string, entry: Entry) {
    this.entries.set(puuid, entry);
    this.bytes += entry.bytes;
    this.trim(Date.now(), puuid);
  }

  private remove(puuid: string) {
    const entry = this.entries.get(puuid);
    if (!entry) return;
    this.entries.delete(puuid);
    this.bytes -= entry.bytes;
  }

  /** Brings both budgets back under their ceilings, never evicting `keep`. */
  private trim(now: number, keep?: string) {
    let recentBytes = 0;
    for (const entry of this.entries.values()) if (entry.freshUntil <= now) recentBytes += entry.bytes;
    // Least recently used recent entries first (the map's order).
    for (const [puuid, entry] of this.entries) {
      if (recentBytes <= this.maxRecentBytes && this.bytes <= this.maxBytes) break;
      if (puuid === keep || entry.freshUntil > now) continue;
      this.remove(puuid);
      recentBytes -= entry.bytes;
    }
    if (this.bytes <= this.maxBytes) return;
    // Still over: the fresh entries that would expire soonest.
    const byExpiry = [...this.entries].sort((a, b) => a[1].freshUntil - b[1].freshUntil);
    for (const [puuid] of byExpiry) {
      if (this.bytes <= this.maxBytes) break;
      if (puuid !== keep) this.remove(puuid);
    }
    log.warn({ entries: this.entries.size, mb: Math.round(this.bytes / 1024 ** 2) }, "cache over its size limit, evicted the oldest recaps");
  }

  private sweep() {
    const now = Date.now();
    const before = this.entries.size;
    for (const [puuid, entry] of this.entries) {
      if (entry.freshUntil <= now && now - entry.lastUsedAt > RECENT_IDLE_MS) this.remove(puuid);
    }
    // Fresh entries whose window closed now count against the recent budget.
    this.trim(now);
    const removed = before - this.entries.size;
    if (removed > 0) {
      log.info({ removed, entries: this.entries.size, mb: +(this.bytes / 1024 ** 2).toFixed(1) }, "idle recaps dropped");
    }
  }
}

export const statsCache = new StatsCache(env.STATS_CACHE_MAX_MB * 1024 ** 2, env.STATS_CACHE_RECENT_MB * 1024 ** 2);
