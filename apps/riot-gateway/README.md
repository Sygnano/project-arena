# Riot gateway

The only process that talks to Riot. It holds the API key, keeps Riot's rate limits per Riot
host, and sends requests in **priority order**. The API, the crawler and the upkeep scripts call it
through `RiotGateway` (`@arena/riot`), with the same `riot.match.getMatch(...)` interface as a
plain Riot client:

```ts
import { Queue } from "@arena/riot";
import { riotGateway } from "../src/riot.js"; // apps/api: new RiotGateway({ url, secret })

const riot = riotGateway.client("refresh"); // every call of this client waits in the refresh bucket
const ids = await riot.match.getAllMatchIdsByPuuid(puuid, "euw1", { queue: Queue.ARENA });
const match = await riot.match.getMatch(ids[0]);
```

It knows nothing about the database or what callers do with an answer: Riot's body goes back
verbatim, the caller parses and stores it.

## Priority buckets

`PRIORITIES` in `packages/riot/src/priority.ts`, highest first:

| Bucket | Used by |
|---|---|
| `lookup` | a visitor's Riot ID search (the refresh stream resolving an unknown Riot ID) |
| `refresh` | the refresh queue fetching new matches of a summoner who has a recap |
| `firstFetch` | the refresh queue fetching a first recap's whole history |
| `upkeep` | `check-recaps`, `retry-skipped`: repairs of stored recaps, ahead of discovery |
| `crawler` | the crawler |

Each Riot host (routing value: `europe`, `americas`, `euw1`, `na1`, ...) has its own queue, a FIFO
per bucket, since that's what Riot's limits count. On one host, a bucket goes through **only once
every bucket above it is empty**, first come first served within a bucket. Hosts never wait for
each other: an NA crawl doesn't slow an EUW lookup. The rule is strict: while a higher bucket's
first request waits for the budget, nothing below it moves, even a request whose own method limit
has room.

To add a bucket (`vip`), insert it at its rank in `PRIORITIES`. The scheduler, the logs and the
header validation all follow the list.

**A bucket is never full.** It holds every request sent to it, however many, and nothing is
refused or timed out for waiting: a lower bucket simply waits as long as the buckets above it
keep receiving requests (decided with the user). The heartbeats keep its callers' streams open
meanwhile. Limiting how much a caller sends is the caller's business (the API caps its own lanes
and lookups, see CLAUDE.md §1).

## Protocol

Shared in `packages/riot/src/protocol.ts`. One `GET` route per Riot endpoint, at Riot's own path
under the platform (match routes take none: the id starts with it):

```
/:platform/riot/account/v1/accounts/by-riot-id/:gameName/:tagLine
/:platform/riot/account/v1/accounts/by-puuid/:puuid
/:platform/lol/summoner/v4/summoners/by-puuid/:puuid
/:platform/lol/match/v5/matches/by-puuid/:puuid/ids?queue&type&startTime&endTime&start&count
/lol/match/v5/matches/:matchId
/lol/match/v5/matches/:matchId/timeline
```

Headers: `x-riot-priority` (a bucket, required) and `x-riot-gateway-secret` (once the gateway has
`RIOT_GATEWAY_SECRET`). The answer is a server-sent event stream:

```
event: hold       data: {"reason":"queue","position":3}         3 requests on this host go first
event: hold       data: {"reason":"rate_limit","waitMs":34200}  next in line, waiting for Riot's budget
event: response   data: <Riot's JSON body>                       final
event: error      data: {"status":404,"message":"...","fatal":false}  final
```

A hold is sent whenever the request's standing changes, never on a timer: its position moves (a
request ahead was sent or left, or a higher-priority one arrived) or it reaches the front. Each
round of sends ends with one pass over the waiting requests, telling only those whose hold
changed: one write per waiting request per send, fine for the hundreds this is sized for (about
1,000 at most). The scripts' buckets, `upkeep` and `crawler`, hear nothing (`hearsHolds` in
`packages/riot/src/priority.ts`): nobody watches them call by call, and they're the ones that pile up. Plain answers before a stream
opens: `400` (bad parameters or priority), `403` (wrong secret).

### Dropped streams

- **The caller leaves** (closes the connection, or its idle timeout fires): the gateway takes the
  request out of its queue, tells those behind it their new position, and never calls Riot for
  it. If the call was already at Riot, its answer is dropped; a retry after Riot's 429 or 5xx
  isn't made.
- **The gateway goes away** (restart, deploy, network cut): the client sees the stream end
  without a final event, or 45s without even a heartbeat (one comes every 15s), and retries with
  backoff (2s, 4s, 8s, 16s; 5 tries), then throws `RiotApiError` with status 0. The retry joins
  the back of its bucket: the place held before is lost. A call already sent to Riot when the
  stream dropped is sent again, costing one more call.

A comment line every 15s keeps a waiting stream alive through proxies.

The refresh queue turns holds into the page's "waiting on Riot" state: a call held 3s or more sets
`RefreshProgress.waitingOnRiot`.

## Files

| File | Job |
|---|---|
| `src/index.ts` | Fastify: the secret check, routes, shutdown. |
| `src/riot.ts` | Wires the one rate limiter, the scheduler and the HTTP client. |
| `src/routes/riotRoutes.ts` | One route per endpoint: validates, then streams holds and Riot's answer. |
| `src/routes/health.ts` | `/health` (open) and `/status` (requests waiting per host and bucket). |
| `src/scheduler/riotScheduler.ts` | `RiotScheduler`: one `HostQueue` per Riot host, priority buckets, holds. |
| `src/sse.ts` | The event stream writer. |
| `src/riotApi/endpoints/*.ts` | Build a `RiotCall` per Riot endpoint (host, path, log args). |
| `src/riotApi/http.ts` | `RiotHttpClient`: the only `fetch`. Takes its turn, sends, retries, logs. |
| `src/riotApi/rateLimiting/` | `headers.ts` parses Riot's limit headers, `rateWindow.ts` is one window (e.g. 100/2m), `rateBucket.ts` one limit (its windows + a Retry-After pause), `rateLimiter.ts` the buckets per host. |
| `src/riotApi/logger.ts` | The request log line format and levels. |
| `src/riotApi/errors.ts` | `RiotCallError` (`status`, `call`, `fatal`), sent to the caller as `error`. |

Shared with callers (`packages/riot`): routing (platforms, clusters), queue ids, the priorities,
the protocol, and the client.

### Adding an endpoint

1. A builder in `src/riotApi/endpoints/` returning a `RiotCallSpec`: `api`, `method` (our name,
   shown in logs, also the method rate-limit key), `platform`, `routing` (`p` for platform-routed
   APIs, `matchRegion(p)` / `accountRegion(p)` for regional ones), `path`, `query`, `args` (what
   the log line shows).
2. A route in `src/routes/riotRoutes.ts` at Riot's path, validating its parameters.
3. Its path in `gatewayPaths` and a method on `RiotClient` (`packages/riot/src/client/`).

Response types live in `@arena/types`.

## Rate limiting

From Riot's docs: every limit is **per routing value**, at two levels:

- **application**: all our calls to one host (dev key: 20/1s and 100/2m);
- **method**: calls to one endpoint on one host (e.g. getMatch: 2000/10s).

`RiotRateLimiter` keeps one app bucket per host and one method bucket per (host, endpoint). The
scheduler sends a host's next request once both of its buckets have room.

- **Limits come from Riot.** App buckets start at a dev key's limits. After the first response
  from a host, each bucket uses the limits in `X-App-Rate-Limit` / `X-Method-Rate-Limit`. So a
  production key's limits apply without a code change.
- **Counts come from Riot too.** When `X-*-Rate-Limit-Count` is higher than our count, the
  bucket adopts it, so anything else spending the same key (a local run with the hosted key)
  slows the gateway down instead of both running into 429s.
- **429s**: `Retry-After` pauses the limit named in `X-Rate-Limit-Type`: `application` pauses the
  whole host, `method`/`service` (or no type) pauses that endpoint on that host. Then the call
  retries.
- Windows are sliding and 250ms longer than Riot's, which is slightly stricter than Riot's own
  fixed windows.

Limiter state is in memory. Run **one** gateway: two would each think they own the budget.

## Retries and errors

Up to 5 tries per call, each retry back at the front of its bucket. 429: wait out Retry-After.
5xx and network errors (incl. the 30s timeout, and a response cut off while its body downloads):
back off 2s, 4s, 8s, 16s. Anything else fails at once. The final failure goes to the caller as an
`error` event with `status` (0 = no response) and `fatal: true` for a bad or expired key
(401/403) and for a PUUID from another Riot app (400 "Exception decrypting", see CLAUDE.md §2).
The client throws it as `RiotApiError`; batch jobs stop on `fatal`. The client itself retries only
reaching the gateway, with the same backoff.

## Logs

One line per event. `RIOT_LOG_LEVEL` sets the level (`debug | info | warn | error | silent`,
default `info`):

```
200  - [Europe]   [EUW1] [Match-V5]    [refresh]    getMatch: EUW1_7991578807 · 129ms · europe 70/100 2m
404  - [Europe]   [EUW1] [Account-V1]  [lookup]     getAccountByRiotId: Nobody#EUW · 35ms
WAIT - [Europe]   [EUW1] [Match-V5]    [crawler]    getMatch: EUW1_7991578808 · 34.2s · europe limit 100/2m full
200  - [Europe]   [EUW1] [Match-V5]    [crawler]    getMatch: EUW1_7991578808 · 412ms · queued 1m17s · europe 100/100 2m
429  - [Americas] [NA1]  [Match-V5]    [firstFetch] getMatchIdsByPuuid: 3fA9x…Qe1 queue=1750 start=0 · 12ms · method limit hit · retry 1/4 in 10s
ERR  - [Europe]   [EUW1] [Summoner-V4] [crawler]    getSummonerByPuuid: 3fA9x…Qe1 · timeout after 30.0s · retry 2/4 in 4s
```

Columns: status (or `WAIT` / `ERR`), region, platform, Riot API, the caller's bucket, our method
and its arguments. After the `·`: time taken, time spent queued (from 1s up), then how full the
key's limit is on that host, turning yellow at 90%, and the method limit once it's half full.
`WAIT` is logged once per request, when it's next in line but the budget isn't there.

| Level | What |
|---|---|
| `debug` | + short waits (under 5s, the normal pacing of a dev key) |
| `info` | every response, 404s, waits of 5s or more |
| `warn` | retries (429, 5xx, network) |
| `error` | final failures |

PUUIDs are shortened on info/debug lines and printed in full on warn/error lines. In hosted logs
(JSON), the line is `msg` and its columns are fields under `riot` (`tag`, `region`, `platform`,
`api`, `method`, `priority`, full `args`).

## Lint and format

Like every package: ESLint through the shared `base` profile (`packages/eslint-config`), and the
repo's one Prettier config at the root (see CLAUDE.md §6).

```
pnpm --filter @arena/riot-gateway lint   # also part of the root `pnpm lint`
pnpm format                              # from the root: Prettier on the whole repo
```

## Running it

- Local: `pnpm --filter @arena/riot-gateway dev` (port 3002; `build` then `start` runs the bundle), with `RIOT_API_KEY` in
  `apps/riot-gateway/.env` (see `.env.example`). The API and the scripts find it at
  `RIOT_GATEWAY_URL`, default `http://localhost:3002`.
- Hosted (Railway): a `riot-gateway` service, the whole repo, deployed as an esbuild bundle
  (install, build and start commands in CLAUDE.md §3's Railway table: `pnpm --filter
  @arena/riot-gateway build`, then `node --enable-source-maps apps/riot-gateway/dist/index.mjs`),
  **no public domain**. Env: `RIOT_API_KEY`,
  `RIOT_GATEWAY_SECRET` (32+ characters, same value in the API and crawler services), `PORT=3002`.
  Callers use `RIOT_GATEWAY_URL=http://${{riot-gateway.RAILWAY_PRIVATE_DOMAIN}}:3002`:
  over the private network the traffic isn't billed, while through a public domain every
  timeline would count as egress.
