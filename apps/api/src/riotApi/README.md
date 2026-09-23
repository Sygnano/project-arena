# riotApi — the Riot API client

Every call the app makes to Riot goes through this folder.

```ts
import { riot, Queue, RiotApiError } from "../riotApi/index.js";

const account = await riot.account.getAccountByRiotId("Name", "EUW", "euw1");
const profile = await riot.summoner.getSummonerByPuuid(account.puuid, "euw1");
const ids = await riot.match.getAllMatchIdsByPuuid(account.puuid, "euw1", { queue: Queue.ARENA });
const match = await riot.match.getMatch(ids[0]);          // platform read from the id: "EUW1_..."
const timeline = await riot.match.getMatchTimeline(ids[0]);
```

Platforms are passed as stored in the database (`summoners.region`: `"euw1"`, any case).

## Files

| File | Job |
|---|---|
| `index.ts` | The process's `riot` instance (from `env`) and the public exports. Import from here. |
| `client.ts` | `RiotClient`: wires limiter + logger + HTTP together and exposes one property per Riot API. |
| `endpoints/accountV1.ts` | Account-V1: `getAccountByRiotId`, `getAccountByPuuid`. |
| `endpoints/summonerV4.ts` | Summoner-V4: `getSummonerByPuuid`. |
| `endpoints/matchV5.ts` | Match-V5: `getMatchIdsByPuuid` (one page), `getAllMatchIdsByPuuid` (every page), `getMatch`, `getMatchTimeline`. |
| `http.ts` | `RiotHttpClient`: the only `fetch`. Rate limiting, key, timeout, retries, errors, logs. Knows no endpoint. |
| `rateLimiting/` | `headers.ts` parses Riot's limit headers, `rateWindow.ts` is one window (e.g. 100/2m), `rateBucket.ts` one limit (its windows + a Retry-After pause), `rateLimiter.ts` the buckets per region. |
| `routing.ts` | Platforms, regions, and which host each API uses for a platform. |
| `queues.ts` | Queue ids (`Queue.ARENA`, ...). |
| `logger.ts` | The request log line format and levels. |
| `errors.ts` | `RiotApiError` (`status`, `call`, `fatal`). |
| `types.ts` | `RiotCall`: one request's description, passed from an endpoint down through every layer. |

Only the endpoints the app uses are here. Riot's full list: <https://developer.riotgames.com/apis>.

### Adding an endpoint

Add a method to the API's file in `endpoints/` (or a new file + a property in `client.ts` for a
new API, plus its name in `RiotApiName`). It only builds a `RiotCall`: `api`, `method` (our name,
shown in logs, also the method rate-limit key), `platform`, `routing` (`p` for platform-routed
APIs, `matchRegion(p)` / `accountRegion(p)` for regional ones), `path`, `query`, and `args` (what
the log line shows). Response types live in `@arena/types`.

## Queues

The queue is an option of the match-list calls, not a constant:

```ts
riot.match.getAllMatchIdsByPuuid(puuid, platform, { queue: Queue.ARENA });           // one queue
riot.match.getAllMatchIdsByPuuid(puuid, platform, { queue: Queue.RANKED_SOLO_DUO });  // another
riot.match.getAllMatchIdsByPuuid(puuid, platform);                                    // every queue
riot.match.getAllMatchIdsByPuuid(puuid, platform, { queue: 1900 });                   // any id works
```

Other filters: `type` (`"ranked" | "normal" | "tourney" | "tutorial"`), `startTime`, `endTime`.
Riot takes a single `queue` per request, so for several queues either call once per queue or
fetch every queue and filter on `info.queueId`. To name a new queue, add it to `Queue` in
`queues.ts`. Check its id on a real match (`info.queueId`): Riot's `queues.json` lags behind
(Arena's 1750 isn't in it).

## Rate limiting

From Riot's docs: every limit is **per routing value**. `europe`, `americas`, `euw1`, `na1`, ...
each have their own budget. There are two levels:

- **application**: all our calls to one host (dev key: 20/1s and 100/2m);
- **method**: calls to one endpoint on one host (e.g. getMatch: 2000/10s).

`RiotRateLimiter` keeps one app bucket per host and one method bucket per (host, endpoint). A
call waits until both have room. So a crawl on EUW never slows a lookup on NA. Account-V1 and
Match-V5 on `europe` share one app budget, and Summoner-V4 on `euw1` has its own.

- **Limits come from Riot.** App buckets start at a dev key's limits. After the first response
  from a host, each bucket uses the limits in `X-App-Rate-Limit` / `X-Method-Rate-Limit`. So a
  production key's limits apply without a code change.
- **Counts come from Riot too.** When `X-*-Rate-Limit-Count` is higher than our count, the
  bucket adopts it. That means another process using the same key (the crawler beside the API)
  slows this one down instead of both running into 429s.
- **429s**: `Retry-After` pauses the limit named in `X-Rate-Limit-Type`: `application` pauses the
  whole host, `method`/`service` (or no type) pauses that endpoint on that host. Then the call
  retries.
- Windows are sliding and 250ms longer than Riot's, which is slightly stricter than Riot's own
  fixed windows.

Limiter state is in memory, per process.

## Retries and errors

Up to 5 tries per call. 429: wait out Retry-After. 5xx and network errors (incl. the 30s
timeout): back off 2s, 4s, 8s, 16s. Anything else fails at once. Failures throw `RiotApiError`
with `status` (0 = no response). It has `fatal: true` for a bad or expired key (401/403) and for
a PUUID from another Riot app (400 "Exception decrypting", fix with `remap-puuids`). Batch jobs
should stop on those.

## Logs

One line per event. `RIOT_LOG_LEVEL` sets the level (`debug | info | warn | error | silent`,
default `info`):

```
200  - [Europe]   [EUW1] [Match-V5]    getMatch: EUW1_7991578807 · 129ms · europe 70/100 2m
404  - [Europe]   [EUW1] [Account-V1]  getAccountByRiotId: Nobody#EUW · 35ms
WAIT - [Europe]   [EUW1] [Match-V5]    getMatch: EUW1_7991578808 · 34.2s · europe limit 100/2m full
429  - [Americas] [NA1]  [Match-V5]    getMatchIdsByPuuid: 3fA9x…Qe1 queue=1750 start=0 · 12ms · method limit hit · retry 1/4 in 10s
ERR  - [Europe]   [EUW1] [Summoner-V4] getSummonerByPuuid: 3fA9x…Qe1 · timeout after 30.0s · retry 2/4 in 4s
```

Columns: status (or `WAIT` / `ERR` for events without one), region, platform, Riot API, our
method and its arguments. After the `·`: time taken, then how full the key's limit is on the host
the call went to, named after it (`europe 70/100 2m`; Riot counts it separately per region, and
per platform for platform-routed calls like Summoner-V4's `euw1`), turning yellow at 90%, and
the method limit once it's half full.

| Level | What |
|---|---|
| `debug` | + short limiter waits (under 5s, the normal pacing of a dev key) |
| `info` | every response, 404s, waits of 5s or more |
| `warn` | retries (429, 5xx, network) |
| `error` | final failures |

PUUIDs are shortened on info/debug lines and printed in full on warn/error lines. Colors turn off
when the output isn't a terminal. Set `NO_COLOR=1` to turn them off anywhere.
