import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { GATEWAY_PRIORITY_HEADER, isPlatform, isPriority, platformOfMatch, type Platform } from "@arena/riot";
import { riotHttp } from "../riot.js";
import { getAccountByPuuid, getAccountByRiotId } from "../riotApi/endpoints/accountV1.js";
import { getMatch, getMatchIdsByPuuid, getMatchTimeline } from "../riotApi/endpoints/matchV5.js";
import { getSummonerByPuuid } from "../riotApi/endpoints/summonerV4.js";
import { RiotCallError } from "../riotApi/errors.js";
import type { RiotCallSpec } from "../riotApi/types.js";
import { openEventStream } from "../sse.js";

const platform = z
  .string()
  .transform((value) => value.toLowerCase())
  .refine((value): value is Platform => isPlatform(value));
const puuid = z.string().min(1).max(100);
// Riot IDs are 3-16 + 3-5 characters; anything longer can't exist.
const riotIdPart = z.string().min(1).max(32);
const matchId = z
  .string()
  .max(40)
  .refine((id) => {
    try {
      platformOfMatch(id);
      return true;
    } catch {
      return false;
    }
  });
const matchIdsQuery = z.object({
  queue: z.coerce.number().int().nonnegative().optional(),
  type: z.enum(["ranked", "normal", "tourney", "tutorial"]).optional(),
  startTime: z.coerce.number().int().nonnegative().optional(),
  endTime: z.coerce.number().int().nonnegative().optional(),
  start: z.coerce.number().int().nonnegative().default(0),
  count: z.coerce.number().int().min(1).max(100).default(100),
});

/**
 * Runs one Riot call for the caller: refuses a bad priority plainly, then
 * streams its holds while it waits (however long) and Riot's answer
 * (see `GatewayEvent`). Riot's 2xx body is passed on verbatim, never parsed.
 * A caller leaving takes a waiting request out of its queue.
 */
async function serve(request: FastifyRequest, reply: FastifyReply, spec: RiotCallSpec | null) {
  if (!spec) return reply.code(400).send({ error: "invalid_parameters" });
  const priority = request.headers[GATEWAY_PRIORITY_HEADER];
  if (!isPriority(priority)) return reply.code(400).send({ error: "invalid_priority" });
  const call = { ...spec, priority };

  const stream = openEventStream(reply);
  const left = new AbortController();
  stream.onClose(() => left.abort(new Error("caller left")));
  try {
    const body = await riotHttp.request(call, { signal: left.signal, onHold: (hold) => stream.send("hold", hold) });
    stream.sendJson("response", body);
  } catch (err) {
    if (left.signal.aborted) {
      request.log.debug({ method: call.method, args: call.args }, "caller left before the answer");
    } else if (err instanceof RiotCallError) {
      stream.send("error", err.toFailure());
    } else {
      request.log.error({ err, method: call.method, args: call.args }, "Riot request failed in the gateway");
      stream.send("error", { status: 500, message: "Riot gateway error", fatal: false });
    }
  } finally {
    stream.end();
  }
}

/** Parses with `schema`, null when the input doesn't fit. */
function parse<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, input: unknown): T | null {
  const result = schema.safeParse(input);
  return result.success ? result.data : null;
}

/**
 * One route per Riot endpoint, at Riot's own path under the platform (see
 * `gatewayPaths` in @arena/riot, which callers build them with). Match
 * routes take no platform: the match id starts with it.
 */
export async function riotRoutes(app: FastifyInstance) {
  app.get("/:platform/riot/account/v1/accounts/by-riot-id/:gameName/:tagLine", (request, reply) => {
    const params = parse(z.object({ platform, gameName: riotIdPart, tagLine: riotIdPart }), request.params);
    return serve(request, reply, params && getAccountByRiotId(params.platform, params.gameName, params.tagLine));
  });

  app.get("/:platform/riot/account/v1/accounts/by-puuid/:puuid", (request, reply) => {
    const params = parse(z.object({ platform, puuid }), request.params);
    return serve(request, reply, params && getAccountByPuuid(params.platform, params.puuid));
  });

  app.get("/:platform/lol/summoner/v4/summoners/by-puuid/:puuid", (request, reply) => {
    const params = parse(z.object({ platform, puuid }), request.params);
    return serve(request, reply, params && getSummonerByPuuid(params.platform, params.puuid));
  });

  app.get("/:platform/lol/match/v5/matches/by-puuid/:puuid/ids", (request, reply) => {
    const params = parse(z.object({ platform, puuid }), request.params);
    const query = parse(matchIdsQuery, request.query);
    return serve(request, reply, params && query && getMatchIdsByPuuid(params.platform, params.puuid, query));
  });

  app.get("/lol/match/v5/matches/:matchId", (request, reply) => {
    const params = parse(z.object({ matchId }), request.params);
    return serve(request, reply, params && getMatch(params.matchId));
  });

  app.get("/lol/match/v5/matches/:matchId/timeline", (request, reply) => {
    const params = parse(z.object({ matchId }), request.params);
    return serve(request, reply, params && getMatchTimeline(params.matchId));
  });
}
