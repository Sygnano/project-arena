import type { Db } from "@arena/db";
import { REGION_LABEL, matchRegion, toPlatform, type GatewayHold, type Region, type RiotGateway } from "@arena/riot";
import type { RefreshProgress } from "@arena/types";
import { logger } from "../logger.js";
import { ingestSummoner } from "./ingestSummoner.js";

/** A summoner whose matches to fetch. `label` ("Name#TAG") is for logs. */
export interface RefreshTarget {
  puuid: string;
  /** Their platform (`euw1`), which decides their lane. */
  region: string;
  label: string;
  /** Never fetched before: their whole history, so it waits behind refreshes. */
  firstFetch: boolean;
}

type Job = RefreshTarget & {
  lane: Region;
  state: RefreshProgress["state"];
  phase: RefreshProgress["phase"];
  done: number;
  total: number;
  startedAt: number | null;
  finishedAt: number | null;
  /** When the match-by-match phase began, for the measured ETA. */
  matchesStartedAt: number | null;
  /** Its current Riot call has been held at the gateway for HOLD_NOTICE_MS or more. */
  waitingOnRiot: boolean;
  holdTimer: ReturnType<typeof setTimeout> | null;
};

/**
 * One regional cluster's line: its waiting jobs and whether one is running.
 * Refreshes of already-fetched summoners (a few matches each) run before
 * waiting first fetches (a whole history, up to hours), so a pile of first
 * fetches can't hold the friend group's refreshes back.
 */
interface Lane {
  refreshes: string[];
  firstFetches: string[];
  running: boolean;
}

type Listener = (progress: RefreshProgress) => void;

// The ETA is the pace measured so far in this fetch, once it has this many
// matches behind it: the key's limits (dev or production) and whatever else
// the gateway runs first set that pace, not a constant.
const MIN_MATCHES_FOR_ETA = 3;
// A Riot call held at the gateway this long (behind higher-priority requests,
// or for Riot's rate limit) shows as "waiting on Riot". Shorter holds are the
// normal pacing between calls.
const HOLD_NOTICE_MS = 3000;
// Finished jobs stay readable for a while, so a page opened right after a
// fetch still sees how it ended.
const FINISHED_JOB_TTL_MS = 10 * 60_000;

const log = logger.child({ module: "queue" });

/** The cluster a summoner's match fetch runs against (Match-V5 routing). */
export function laneOf(platform: string): Region {
  return matchRegion(toPlatform(platform));
}

/**
 * The one place the API process fetches matches from Riot, with one lane per
 * Riot regional cluster (europe, americas, asia, sea). Riot's rate limits are
 * per cluster, so a fetch on NA never waits behind one on EUW, while EUW and
 * EUNE share a lane because they share the `europe` budget (two lanes there
 * would only compete for it). Within a lane, one summoner at a time:
 * refreshes first, then first fetches, each first come first served (see
 * `Lane`). Their Riot calls wait at the Riot gateway in the `refresh` or
 * `firstFetch` bucket, ahead of the crawler's and behind visitors' lookups.
 * Bulk ingestion isn't queued here: it's `scripts/crawl.ts`, its own process.
 *
 * In memory: a restart drops the queue and the next refresh press queues
 * again (ingestion skips matches already stored). Anyone can follow a job
 * with `subscribe` (the refresh stream does): its position in its lane, then
 * match by match.
 */
export class RefreshQueue {
  private jobs = new Map<string, Job>();
  private lanes = new Map<Region, Lane>();
  private listeners = new Map<string, Set<Listener>>();

  constructor(
    private readonly db: Db,
    private readonly gateway: RiotGateway,
  ) {}

  private lane(region: Region): Lane {
    let lane = this.lanes.get(region);
    if (!lane) this.lanes.set(region, (lane = { refreshes: [], firstFetches: [], running: false }));
    return lane;
  }

  /** Queues a fetch, unless one is already queued or running for this summoner. */
  enqueue(target: RefreshTarget) {
    const existing = this.jobs.get(target.puuid);
    if (existing && this.isActiveJob(existing)) return;
    const laneName = laneOf(target.region);
    this.jobs.set(target.puuid, {
      ...target,
      lane: laneName,
      state: "queued",
      phase: null,
      done: 0,
      total: 0,
      startedAt: null,
      finishedAt: null,
      matchesStartedAt: null,
      waitingOnRiot: false,
      holdTimer: null,
    });
    const lane = this.lane(laneName);
    (target.firstFetch ? lane.firstFetches : lane.refreshes).push(target.puuid);
    log.info(
      {
        summoner: target.label,
        lane: REGION_LABEL[laneName],
        firstFetch: target.firstFetch,
        position: this.progress(target.puuid)?.position,
      },
      "fetch queued",
    );
    // A refresh moves every waiting first fetch back a place.
    this.notifyQueued(laneName);
    void this.drain(laneName);
  }

  /** Jobs of this kind waiting in a platform's lane, behind the one running there. */
  waitingCount(platform: string, kind: "refreshes" | "firstFetches") {
    return this.lane(laneOf(platform))[kind].length;
  }

  isActive(puuid: string) {
    const job = this.jobs.get(puuid);
    return job !== undefined && this.isActiveJob(job);
  }

  /** The job's progress, or null when there's none (or it ended a while ago). */
  progress(puuid: string): RefreshProgress | null {
    this.prune();
    const job = this.jobs.get(puuid);
    if (!job) return null;
    const lane = this.lane(job.lane);
    const ahead = job.firstFetch
      ? lane.refreshes.length + lane.firstFetches.indexOf(puuid)
      : lane.refreshes.indexOf(puuid);
    const position = job.state === "queued" ? ahead + (lane.running ? 1 : 0) : 0;
    return {
      state: job.state,
      position,
      phase: job.phase,
      done: job.done,
      total: job.total,
      etaSeconds: job.state === "running" && job.phase === "matches" ? this.etaSeconds(job) : null,
      waitingOnRiot: job.state === "running" && job.waitingOnRiot,
    };
  }

  /** Seconds left at the pace this fetch has kept so far, null until it has one. */
  private etaSeconds(job: Job) {
    if (job.matchesStartedAt === null || job.done < MIN_MATCHES_FOR_ETA) return null;
    const secondsPerMatch = (Date.now() - job.matchesStartedAt) / 1000 / job.done;
    return Math.ceil((job.total - job.done) * secondsPerMatch);
  }

  /**
   * Follows the job's current Riot call at the gateway: a hold that lasts
   * HOLD_NOTICE_MS turns `waitingOnRiot` on, the call leaving the gateway
   * turns it off.
   */
  private onHold(job: Job, hold: GatewayHold | null) {
    if (hold !== null) {
      if (job.waitingOnRiot || job.holdTimer) return;
      job.holdTimer = setTimeout(() => {
        job.holdTimer = null;
        job.waitingOnRiot = true;
        this.notify(job.puuid);
      }, HOLD_NOTICE_MS);
      return;
    }
    if (job.holdTimer) clearTimeout(job.holdTimer);
    job.holdTimer = null;
    if (job.waitingOnRiot) {
      job.waitingOnRiot = false;
      this.notify(job.puuid);
    }
  }

  /** Calls `listener` on every change to this summoner's job. Returns the unsubscribe. */
  subscribe(puuid: string, listener: Listener): () => void {
    let set = this.listeners.get(puuid);
    if (!set) this.listeners.set(puuid, (set = new Set()));
    set.add(listener);
    return () => {
      set.delete(listener);
      // Only this set's own entry: a later subscriber may have made a new one.
      if (set.size === 0 && this.listeners.get(puuid) === set) this.listeners.delete(puuid);
    };
  }

  private isActiveJob(job: Job) {
    return job.state === "queued" || job.state === "running";
  }

  private notify(puuid: string) {
    const set = this.listeners.get(puuid);
    if (!set) return;
    const progress = this.progress(puuid);
    if (!progress) return;
    for (const listener of set) listener(progress);
  }

  /** Every waiting job's position moves when its lane does. */
  private notifyQueued(laneName: Region) {
    const lane = this.lane(laneName);
    for (const puuid of [...lane.refreshes, ...lane.firstFetches]) this.notify(puuid);
  }

  private prune() {
    const now = Date.now();
    for (const [puuid, job] of this.jobs) {
      if (job.finishedAt !== null && now - job.finishedAt > FINISHED_JOB_TTL_MS) this.jobs.delete(puuid);
    }
  }

  /** Runs a lane's jobs one after another until it's empty. Lanes run side by side. */
  private async drain(laneName: Region) {
    const lane = this.lane(laneName);
    if (lane.running) return;
    lane.running = true;
    try {
      for (;;) {
        const next = lane.refreshes.shift() ?? lane.firstFetches.shift();
        if (next === undefined) break;
        const job = this.jobs.get(next);
        if (!job) continue;
        await this.run(job);
      }
    } finally {
      lane.running = false;
    }
  }

  private async run(job: Job) {
    job.state = "running";
    job.startedAt = Date.now();
    const lane = REGION_LABEL[job.lane];
    const waiting = this.lane(job.lane);
    log.info(
      {
        summoner: job.label,
        lane,
        waitingRefreshes: waiting.refreshes.length,
        waitingFirstFetches: waiting.firstFetches.length,
      },
      "fetch started",
    );
    this.notify(job.puuid);
    this.notifyQueued(job.lane);
    const riot = this.gateway.client(job.firstFetch ? "firstFetch" : "refresh", {
      onHold: (hold) => this.onHold(job, hold),
    });
    try {
      const { ingested, skipped, bad } = await ingestSummoner(
        this.db,
        riot,
        job,
        (progress) => {
          job.phase = progress.phase;
          if (progress.phase === "matches") {
            job.matchesStartedAt ??= Date.now();
            job.done = progress.done;
            job.total = progress.total;
          }
          this.notify(job.puuid);
        },
        {
          onSkip: (skip) =>
            log.warn(
              { summoner: job.label, lane, ...skip },
              "match failed, skipped until the next refresh, see skipped_matches",
            ),
          onBadMatch: (badMatch) =>
            log.info({ summoner: job.label, lane, ...badMatch }, "bad match, won't be fetched again"),
        },
      );
      job.state = "done";
      log.info(
        {
          summoner: job.label,
          lane,
          newMatches: ingested,
          skipped,
          bad,
          seconds: Math.round((Date.now() - job.startedAt) / 1000),
        },
        "fetch finished",
      );
    } catch (err) {
      job.state = "failed";
      log.error({ summoner: job.label, lane, err }, "fetch failed");
    }
    this.onHold(job, null);
    job.finishedAt = Date.now();
    this.notify(job.puuid);
  }
}
