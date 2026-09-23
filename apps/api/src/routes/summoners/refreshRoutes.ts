import type { FastifyBaseLogger, FastifyInstance } from "fastify";
import type { Summoner } from "@arena/db";
import type { RefreshProgress } from "@arena/types";
import { refreshQueue } from "../../ingestion/index.js";
import { resolveSummonerByRiotId } from "../../ingestion/resolveSummoner.js";
import { riotIdLabel } from "../../logger.js";
import { clientIp, SlidingWindowLimiter } from "../../rateLimit.js";
import { REFRESH_COOLDOWN_MS, statsCache } from "../../summoners/statsCache.js";
import {
  findSummonerByPuuid,
  findSummonerByRiotId,
  getMatchSummary,
  toSummonerView,
} from "../../summoners/summonerRepository.js";
import { openEventStream, type EventStream } from "./eventStream.js";
import { parseRiotIdParams, type RiotIdParams } from "./riotIdParams.js";

// Requests that make us call Riot (a Riot ID lookup or a match fetch), per
// visitor IP: generous for a person, tight for a script.
const riotRequestLimiter = new SlidingWindowLimiter(30, 10 * 60_000);
// First fetches (a whole match history, ~2.4s a match on a dev key) per
// visitor IP: the expensive thing to abuse.
const firstFetchLimiter = new SlidingWindowLimiter(5, 60 * 60_000);
// No new first fetch while this many wait in the summoner's region, so a
// flood can't push the friend group's refreshes there back by hours.
const MAX_WAITING_JOBS = 10;
// Refresh streams open at once per visitor IP. Following a fetch costs no
// limiter slot, so without this one client could hold any number of streams
// (each also proxied by the web server). A stream counts until its handler
// returns, which includes a Riot lookup still waiting after the visitor left.
const MAX_OPEN_STREAMS_PER_IP = 4;
const openStreamsByIp = new Map<string, number>();

/** Resolves when the summoner's fetch ends, or with "closed" when the visitor leaves first. */
function followFetch(stream: EventStream, puuid: string): Promise<RefreshProgress | "closed"> {
  return new Promise((resolve) => {
    const finish = (outcome: RefreshProgress | "closed") => {
      unsubscribe();
      resolve(outcome);
    };
    const onProgress = (progress: RefreshProgress) => {
      stream.send("progress", progress);
      if (progress.state === "done" || progress.state === "failed") finish(progress);
    };
    const unsubscribe = refreshQueue.subscribe(puuid, onProgress);
    stream.onClose(() => finish("closed"));
    // The job may already have moved on before this subscribed.
    const current = refreshQueue.progress(puuid);
    if (current) onProgress(current);
  });
}

async function sendSummoner(stream: EventStream, summoner: Summoner) {
  const { matchCount } = await getMatchSummary(summoner.puuid);
  stream.send("summoner", toSummonerView(summoner, matchCount));
}

async function sendRecap(stream: EventStream, summoner: Summoner) {
  stream.sendJson("stats", await statsCache.get(summoner));
  stream.send("done", {});
}

/**
 * The refresh flow, one event at a time (see `RefreshEvent`):
 * 1. find the summoner in our database, or look the Riot ID up at Riot;
 * 2. send the summoner;
 * 3. queue a match fetch, unless one is already running (then follow it) or
 *    the last one finished under 15 minutes ago (then skip to 4);
 * 4. send progress until the fetch ends, then the recap.
 * The visitor leaving doesn't stop the fetch: its matches are stored anyway.
 */
async function streamRefresh(stream: EventStream, { region, gameName, tagLine }: RiotIdParams, ip: string, log: FastifyBaseLogger) {
  let chargedRiotRequest = false;
  const allowed = (limiter: SlidingWindowLimiter) => {
    const result = limiter.hit(ip);
    if (!result.ok) {
      log.warn({ ip }, "refresh refused: rate limited");
      stream.send("error", { code: "rate_limited", retryAfterSeconds: result.retryAfterSeconds });
    }
    return result.ok;
  };

  let summoner: Summoner | null | undefined = await findSummonerByRiotId(region, gameName, tagLine);
  if (!summoner) {
    if (!allowed(riotRequestLimiter)) return;
    chargedRiotRequest = true;
    summoner = await resolveSummonerByRiotId(region, gameName, tagLine);
    if (!summoner) {
      stream.send("error", { code: "not_found" });
      return;
    }
  }
  const { puuid } = summoner;
  const label = riotIdLabel(summoner);
  await sendSummoner(stream, summoner);

  if (refreshQueue.isActive(puuid)) {
    log.info({ summoner: label }, "following the fetch already running");
  } else {
    const lastRefreshedAt = summoner.lastRefreshedAt?.getTime();
    if (lastRefreshedAt !== undefined && Date.now() - lastRefreshedAt < REFRESH_COOLDOWN_MS) {
      log.info({ summoner: label }, "fetched under 15 minutes ago, sending the recap as is");
      await sendRecap(stream, summoner);
      return;
    }
    const firstFetch = lastRefreshedAt === undefined;
    if (firstFetch) {
      const waiting = refreshQueue.waitingCount(summoner.region);
      if (waiting >= MAX_WAITING_JOBS) {
        log.warn({ summoner: label, waiting }, "first fetch refused: queue full");
        stream.send("error", { code: "busy" });
        return;
      }
      if (!allowed(firstFetchLimiter)) return;
    }
    if (!chargedRiotRequest && !allowed(riotRequestLimiter)) return;
    log.info({ summoner: label }, firstFetch ? "first fetch requested" : "refresh requested");
    refreshQueue.enqueue({ puuid, region: summoner.region, label });
  }

  const outcome = await followFetch(stream, puuid);
  if (outcome === "closed") {
    log.info({ summoner: label }, "visitor left, the fetch carries on");
    return;
  }
  if (outcome.state === "failed") {
    stream.send("error", { code: "failed" });
    return;
  }
  // Re-read: the fetch stamped a new `lastRefreshedAt`.
  const refreshed = (await findSummonerByPuuid(puuid)) ?? summoner;
  await sendSummoner(stream, refreshed);
  await sendRecap(stream, refreshed);
}

/**
 * `POST .../refresh`: the only summoner route that reaches Riot, as a
 * server-sent event stream the page follows until the recap arrives.
 */
export async function refreshRoutes(app: FastifyInstance) {
  app.post("/summoners/by-riot-id/:region/:gameName/:tagLine/refresh", async (request, reply) => {
    const params = parseRiotIdParams(request.params);
    if (!params) return reply.code(400).send({ error: "invalid_riot_id" });
    const log = request.log.child({ module: "refresh" });
    const ip = clientIp(request);
    const stream = openEventStream(reply);
    const open = openStreamsByIp.get(ip) ?? 0;
    if (open >= MAX_OPEN_STREAMS_PER_IP) {
      log.warn({ ip, open }, "refresh refused: too many open streams");
      stream.send("error", { code: "rate_limited", retryAfterSeconds: 60 });
      stream.end();
      return;
    }
    openStreamsByIp.set(ip, open + 1);
    try {
      await streamRefresh(stream, params, ip, log);
    } catch (err) {
      log.error({ err, summoner: `${params.gameName}#${params.tagLine}` }, "refresh stream failed");
      stream.send("error", { code: "unavailable" });
    } finally {
      stream.end();
      const left = (openStreamsByIp.get(ip) ?? 1) - 1;
      if (left > 0) openStreamsByIp.set(ip, left);
      else openStreamsByIp.delete(ip);
    }
  });
}
