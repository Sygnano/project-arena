import type { FastifyInstance } from "fastify";
import type { SummonerPageData } from "@arena/types";
import { refreshQueue } from "../../ingestion/index.js";
import { riotIdLabel } from "../../logger.js";
import { clientIp, SlidingWindowLimiter } from "../../rateLimit.js";
import { statsCache } from "../../summoners/statsCache.js";
import { findSummonerByRiotId, getMatchSummary, toSummonerView } from "../../summoners/summonerRepository.js";
import { parseRiotIdParams } from "./riotIdParams.js";

const BY_RIOT_ID = "/summoners/by-riot-id/:region/:gameName/:tagLine";

// Recaps read per visitor IP. A recap not in the stats cache costs ~50-150 ms
// of this process's only thread to build (and the page around it as much
// again on the web server), so an unlimited loop over stored summoners could
// stall everything else. Far more than a person opens.
const statsReadLimiter = new SlidingWindowLimiter(60, 10 * 60_000);

/**
 * The summoner page's reads. Our database only, never Riot: a Riot ID that
 * isn't stored yet is a 404, and the page offers to fetch it (the refresh
 * stream, `refreshRoutes.ts`).
 */
export async function readRoutes(app: FastifyInstance) {
  // The summoner and their fetch in progress, if any: enough for the page to
  // pick between the recap, the "fetch matches" screen and the progress screen.
  app.get(BY_RIOT_ID, async (request, reply): Promise<SummonerPageData | { error: string }> => {
    const params = parseRiotIdParams(request.params);
    if (!params) return reply.code(400).send({ error: "invalid_riot_id" });
    const summoner = await findSummonerByRiotId(params.region, params.gameName, params.tagLine);
    if (!summoner) {
      request.log.info({ module: "summoner", summoner: `${params.gameName}#${params.tagLine}` }, "not in the database");
      return reply.code(404).send({ error: "not_found" });
    }
    const { matchCount } = await getMatchSummary(summoner.puuid);
    request.log.info({ module: "summoner", summoner: riotIdLabel(summoner), matches: matchCount }, "summoner served");
    return { summoner: toSummonerView(summoner, matchCount), refresh: refreshQueue.progress(summoner.puuid) };
  });

  // The recap, from the stats cache (a JSON string, sent as is).
  app.get(`${BY_RIOT_ID}/stats`, async (request, reply) => {
    const params = parseRiotIdParams(request.params);
    if (!params) return reply.code(400).send({ error: "invalid_riot_id" });
    const ip = clientIp(request);
    const limited = statsReadLimiter.hit(ip);
    if (!limited.ok) {
      request.log.warn({ module: "summoner", ip }, "recap refused: rate limited");
      return reply
        .code(429)
        .header("retry-after", String(limited.retryAfterSeconds))
        .send({ error: "rate_limited", retryAfterSeconds: limited.retryAfterSeconds });
    }
    const summoner = await findSummonerByRiotId(params.region, params.gameName, params.tagLine);
    if (!summoner) return reply.code(404).send({ error: "not_found" });
    return reply.type("application/json; charset=utf-8").send(await statsCache.get(summoner));
  });
}
