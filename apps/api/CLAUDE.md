# apps/api

Fastify API, the refresh queue, and the scripts (crawlers, check-recaps, retry-skipped, migrate).
Every Riot call goes through the Riot gateway via `riotGateway.client(priority)` (`src/riot.ts`,
which keeps the `riot.match.getMatch(...)` interface); this process never holds the Riot key.
Riot/Arena data facts: `.claude/rules/arena-data.md`. Deployment: `docs/deployment.md`.

## Refresh stream: the only way a visitor spends Riot calls

- `POST /summoners/by-riot-id/:region/:gameName/:tagLine/refresh`
  (`src/routes/summoners/refreshRoutes.ts`, server-sent events typed `RefreshEvent` in
  `@arena/types`) resolves an unknown Riot ID (account-v1 + summoner-v4), sends the summoner,
  queues and follows the match fetch, then sends the new recap. A stream attaches to a running
  job without starting one.
- `GET /summoners/by-riot-id/...` (summoner + fetch in progress) and `.../stats` only read the
  database. Never add a Riot call to a read, a search or anything but this stream; a new
  Riot-backed feature extends it or adds a similar stream.
- Queue entries belong to the work, not the visitor: one job per summoner, one shared lookup per
  unstored Riot ID (`pendingLookups`). Joining a running job or lookup costs no rate-limit charge
  and no slot. Dedupe any new visitor-triggered Riot work by what it fetches.
- A refresh requested under 15 min after `lastRefreshedAt` just returns the recap.
  `lastRefreshedAt` is stamped only when a match fetch finishes, never by a view, and is the only
  "last updated" time anywhere.
- A successful Riot ID lookup also corrects the stored platform.

## Limits (`src/rateLimit.ts`)

- Per visitor IP (an IPv6 visitor is keyed on their /64, `rateLimitKey`): 30 Riot lookups or
  fetches / 10 min, 5 first fetches / hour, 4 refresh streams open at once, 60 recap reads
  (`GET .../stats`) / 10 min. Following a running fetch or lookup is free.
- Shared limits answer `busy` (a pool of addresses gets past per-IP ones): no new first fetch
  while 10 wait in a lane, no new refresh while 50 do, at most 10 Riot ID lookups running per
  Account-V1 cluster, 200 refresh streams open overall.
- The visitor IP is `x-arena-client-ip`, set by the web server. It's trusted because once
  `API_PROXY_SECRET` is set the API refuses every request without `x-arena-proxy-secret`, except
  `/health`. The API has no CORS and no public domain.

## Refresh queue (`src/ingestion/refreshQueue.ts`)

- One lane per Riot regional cluster (europe, americas, asia, sea), since Riot's limits are per
  cluster: one summoner at a time per lane, lanes side by side. EUW, EUNE, TR, RU and ME share
  `europe`; OCE, SG, TW and VN share `sea`. Positions, "queue full" and ETAs are per lane, never
  global; new queued Riot work picks its lane from the routing value it calls.
- Within a lane, refreshes of already-fetched summoners run before waiting first fetches.
- In memory (a restart drops the queue); `subscribe()` feeds the streams. The ETA is the pace
  measured so far in that fetch. A gateway hold of 3 s or more becomes
  `RefreshProgress.waitingOnRiot` ("waiting on Riot" on the page).
- Gateway buckets by caller: Riot ID search `lookup`, refresh `refresh`, first fetch
  `firstFetch`, check-recaps and retry-skipped `upkeep`, crawlers `crawler`. A lane or crawler
  worker sends one call at a time.

## Ingestion (`src/ingestion/`)

- A first fetch pulls the full history, 2 Riot calls per match (match + timeline). Later
  refreshes ask only for games since the previous one, minus a 2 h overlap. A match is stored
  once however many of its players get refreshed.
- Every participant of a newly stored match is added to `summoners` with `lastRefreshedAt` null,
  so the crawl snowballs. A discovered row takes its Riot ID/icon/level from that match and its
  platform from the match id's prefix (Match-V5 lists a player's games on every platform of the
  cluster), as does the match. Ingestion never overwrites an existing summoner row from match
  data: a match can predate a rename.
- account-v1 is the only source of current names. Both account-v1 paths live in
  `resolveSummoner.ts` (`resolveSummonerByRiotId`, `refreshSummonerProfile`) and write through
  `saveSummonerFromRiot`, the only writer of Riot profile fields.
- **Bad match** (`endOfGameResult` other than `GameComplete`, e.g. an aborted lobby): recorded in
  `bad_matches` and never fetched again, by any refresh or script. Checked right after the match
  call, before the timeline call.
- **Failed match** (Riot answers a 4xx other than 429 for it or its timeline, the parser throws,
  or Postgres rejects its rows): stored nowhere, logged in `skipped_matches` (stage, Riot status,
  error, repeat count; deleted once it stores) and in the process log, fetched again later. The
  refresh goes on.
- Outages (network, 5xx, 429) fail the refresh, and so do 5 matches in a row failing at parse or
  store with the same error (`FailureBreaker` in `ingestSummoner.ts`).
- Any new ingestion path keeps this split: no partial matches, one broken match never blocks a
  summoner, nothing excluded for good except by its end-of-game result. Missing matches: look in
  `skipped_matches`.

## Scripts (`scripts/`; by hand `pnpm --filter @arena/api <name>`)

- `crawl` (`--summoners N`; Railway runs `--forever`): one worker per lane, each refreshing a
  never-refreshed summoner. With none left it goes through refreshed ones, oldest
  `lastRefreshedAt` first, skipping anyone refreshed in the last 15 min; with nobody qualifying it
  looks again every minute. It waits out errors. Before each summoner's matches it refreshes
  their profile (account-v1 + summoner-v4); keep that. A platform with no summoner at all is
  seeded from `crawl-seeds.ts` and crawled first. Don't add scheduling, fairness or freshness
  features (interleaving recap owners, "due after N hours"); its only job is discovery.
- `crawl:leaderboard` (`--start-rank N`, `--players N`): walks arenasweats.lol's global Arena
  leaderboard. One page of 125 ranks is split into one unbounded bucket per lane by region; a
  lane running dry fetches the next page for every bucket. Past the last rank, or after a
  restart, it starts again at rank 1 (gaps and repeats accepted). Players refreshed in the last
  6 h are skipped without a Riot call.
- `check-recaps`: re-asks Riot for the whole history of every summoner with a `lastRefreshedAt`
  (one worker per cluster), fetches what isn't stored, stamps each one, exits. Run now and then.
- `retry-skipped`: fetches every `skipped_matches` row again and exits (a Railway cron). Stops on
  the `FailureBreaker` too.
- `migrate`: the Railway pre-deploy migration (`docs/deployment.md`).
- `build:scripts` bundles every `scripts/*.ts` no other script imports, so a new script needs no
  listing.

## Recap (`src/summoners/stats/`)

- Built in memory from three queries in `loadStatsData.ts` (the summoner's games, everyone in
  them, their duels). Each section of the response is a function over those rows in `sections/`,
  assembled by `buildSummonerStats.ts`. A new stat is a function over the loaded rows, never a
  new query. `aggregate.ts` has SQL-like helpers (`sum` counts null as 0, `avg`/`max` skip
  nulls). Break ties by id so output is stable. Placement-0 games (broken lobbies) are left out.
- The payload (`SummonerStatsPayload`) carries ids only. Names, icons and rarity come from
  `GET /catalog` (`src/leagueData/gameCatalog.ts`): a new item/augment/champion field goes in the
  catalog, never per row. Per-row `championName` keys stay.
- No PUUIDs in any response (teammate and opponent rows carry `id`, their index in the server's
  list) and no raw error text (the error handler answers a bare 500).
- Stats cache (`src/summoners/statsCache.ts`), recaps kept as JSON strings. **Fresh**: until
  15 min after the summoner's `lastRefreshedAt`. **Recent**: any other recap someone opened, LRU
  within `STATS_CACHE_RECENT_MB` (256), for at most an hour after its last view. Invalidated by
  the summoner's game count + latest game time, swept every minute, capped at
  `STATS_CACHE_MAX_MB` (1024, recent evicted first). Sizes count 2 bytes a character when the
  JSON holds any non-Latin-1 character.

## Summoners and Riot IDs

- Look summoners up by `riot_id_key` (`riotIdKey()` from `@arena/db`, indexed with the region),
  never `lower()` in SQL: the C collation only lowercases ASCII. Every writer of `summoners` goes
  through `riotIdColumns()`.
- Riot ID validation: `src/routes/summoners/riotIdParams.ts`, mirroring apps/web's
  `utils/riot-id.ts`. Game names are letters, digits, combining marks and spaces only; control
  characters are refused (a NUL failed the Postgres query).
- `summoners` holds every player the crawler met (about a million rows): anything listing it must
  limit or filter. `GET /dev/summoners` is capped at 500.
- `/health` answers 503 when the database doesn't answer. `MAINTENANCE_MODE=true`: every other
  route answers 503 `maintenance`, `/health` 200, and no migrations run. The server listens on `::` and closes
  cleanly on SIGTERM.

## Accepted tradeoffs (reviewed with the user; don't raise again unless something changes)

- Database growth from the always-on crawler (about 1 TB available).
- CommunityDragon data cached for the process lifetime; the API is restarted after a patch.
- Prismatic item stats come from end-of-match inventory only.
- The per-IP first-fetch slot can be spent even when another limit then refuses the request.
- The stats cache's 1024 MB default cap.

## Known gaps

- The API and the crawler can fetch the same summoner at once. Each match is rechecked against
  `matches` and `bad_matches` right before its Riot calls, so the waste is small; the stronger
  fix (an atomic `refresh_started_at` lease the crawler skips) isn't built.
