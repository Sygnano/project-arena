# Backend audit (2026-09-23)

A senior-backend review of `apps/api`, `packages/db`, `packages/types`, the crawler and scripts,
and the web app's proxy to the API. Nothing in this file has been acted on unless its status says
so. Tradeoffs already reviewed and accepted in September 2026 are left out on purpose: the
crawler sharing the Riot key's budget with the API, database growth, CommunityDragon cached for
the process lifetime, Prismatic stats from end-of-match inventory, the first-fetch rate-limit
slot, and the stats cache's 1024 MB cap.

Measurements come from the local database at the time (1,519 matches, 13,493 summoners, of which
2 refreshed), read-only. Typecheck (`@arena/api`, `@arena/db`) passed.

## Verdict

The backend is in good shape for its scale. The Riot client adjusts to Riot's rate limits on its
own, fetches queue per region, caches share one build when requests overlap, error responses leak
nothing, and shutdown is clean. At the local database's size every hot query took 25 ms or less
(the heaviest, co-participants for a 462-game player, 22.7 ms), so no index work is needed. The
real gaps were duplicate Riot calls when two processes fetch the same matches, one failure mode
that fails silently, and the lack of any tests. As of 2026-09-24, 2 (partly), 3, 5, 6, 7 and 8
are fixed, 1 is by design, and the polish items are fixed or closed; tests (4) and the
same-summoner lease from 2 remain.

## High priority

### 1. Once discovery starts, the crawler never re-checks anyone

`apps/api/scripts/crawl.ts` (`nextSummoner`) orders by `last_refreshed_at asc nulls first`. Each
stored match adds about 9 never-refreshed players, and each of them brings their whole history.
Locally: 13,491 never-refreshed summoners against 2 refreshed ones, from 1,519 matches. The backlog
grows faster than a lane can clear it at about 2.4 s per match, so the "due after 24h" branch never
runs, and the friend group is only refreshed when someone presses the button.

Fix: interleave. For example, every other pick in a lane is the stalest summoner who already has a
recap. Decide first whether pure discovery is what's wanted.

Status: not an issue, by design (decided with the user 2026-09-24). The crawler is pure discovery:
its only job is to absorb as many matches as possible, not to keep anyone up to date. Recaps are
refreshed from the page's REFRESH button. Anything the crawler spends Riot calls on other than new
matches is overhead. The "due after 24h" branch was removed the same day: `crawl:forever` now takes
never-refreshed summoners first and then the oldest refresh (not refreshed in the last 15 minutes),
and is switched off by hand once that's all it does.

### 2. Two processes can pay Riot for the same match twice

`ingestSummoner` builds the "already stored" set once, at the start of a refresh. A first fetch runs
for hours, and meanwhile the crawler walks the same premade's matches. Each overlap costs 2 Riot
calls (about 2.4 s of the region's budget); the insert then discards the second copy. The API can
even start a first fetch for a summoner the crawler is fetching right now.

- Cheap fix: check `matches` again right before each match's two Riot calls (a sub-millisecond
  primary-key lookup that saves 2 calls).
- Stronger fix: a `refresh_started_at` lease the crawler claims atomically
  (`UPDATE ... WHERE refresh_started_at IS NULL OR refresh_started_at < now() - interval ...`) and
  skips when someone else holds it.

Status: cheap fix done 2026-09-24. `ingestSummoner` checks `matches` and `bad_matches` again for
each match just before its Riot calls (`knownMatchIds`), and skips it if another process stored it
in the meantime, counting it as done in the progress. This covers overlapping teammates' histories.
It doesn't cover two processes refreshing the same summoner at once: both walk the same list in the
same order, so the later run skips ahead until it reaches the match the earlier one is fetching,
and from then on they fetch every remaining match twice, side by side. The lease would prevent that.
Not done yet, since it needs a new column.

### 3. A bug that breaks every match looks like a run of skipped matches

If Riot renames a field or a parser bug ships, every match fails at `parse` or `store`. Each one is
recorded in `skipped_matches`, and the refresh still succeeds and stamps `lastRefreshedAt`. The
crawler would then stamp its whole backlog as refreshed with zero matches, and recovering means a
full `check-recaps` run.

Fix: keep skipping single failed matches, but add a breaker. For example, if 5 matches in a row
fail at parse or store with the same error, fail the refresh. The crawler's existing "5 failures in
a row" handling then pauses it.

Status: fixed 2026-09-24. `ingestSummoner` runs each match's outcome through a `FailureBreaker`:
the 5th parse or store failure in a row with the same error throws `RepeatedFailureError`, so the
refresh fails without stamping `lastRefreshedAt`. That covers the site's refreshes too, where the
same bug gave a first fetch an empty recap with no FETCH MATCHES button. The five matches stay in
`skipped_matches`, and a new cron script, `retry-skipped`, fetches every row of that table again,
so a failed match no longer depends on a later refresh listing it.

### 4. No tests and no CI

The most valuable code is pure and easy to test:

- `parseRounds` (its heuristics come with measured error rates) and the undo handling in
  `parseMatch`;
- `rateLimitKey`, which is security-relevant (IPv6 /64 keying);
- `riotIdKey`, `RateWindow`, the ordering of `RefreshQueue`, and the stats cache's eviction.

Fixture matches exist in `../project-arena/data/matches`. Add `node:test` or vitest, plus a snapshot
test that builds a recap from those fixtures, and gate pull requests with the Turborepo `typecheck`
and `test` tasks.

## Medium

### 5. Possible deadlock when storing new players

`ingestMatch` inserts new `summoners` rows in the match's participant order. Two processes storing
two different matches that share new players (a premade trio) can lock the same rows in opposite
order, and Postgres aborts one with a deadlock error (40P01). That isn't a data error, so the whole
refresh fails. Rare; sorting the players by puuid fixes it in one line.

Status: fixed 2026-09-24. `participantSummoners` sorts a match's players by puuid, so every
process inserts (and locks) shared players in the same order.

### 6. A failed Riot response download is never retried

In `apps/api/src/riotApi/http.ts`, `res.json()` (success path) and `res.text()` (error path) run
outside the retry `try`. A connection reset or timeout while downloading a 1.5 MB timeline fails
the whole refresh instead of being retried like any network error.

Status: fixed 2026-09-24. The body is read right after the headers, inside its own retry, so a
reset or the 30 s timeout during the download backs off and retries like a failed connection
(checked with a simulated reset mid-body: retried after 2 s, then succeeded). The logged time now
includes the download.

### 7. The database has no timeouts

`packages/db/src/client.ts` uses the postgres.js defaults, and locally both `statement_timeout` and
`idle_in_transaction_session_timeout` are 0. One stuck query or lock can freeze a region's refresh
lane (`lane.running` never clears), and every later refresh in that region waits forever. The
`/health` check's `select 1` can hang the same way. Set both timeouts on the API's connection (for
example 15 s and 30 s).

Status: fixed 2026-09-24. `createDb` takes `statementTimeoutMs` / `idleInTransactionTimeoutMs`,
sent as startup parameters on every connection; the API's `db` (also used by the scripts) sets 15 s
and 30 s (checked: `current_setting` reports both). The startup migrations keep their own
connection without them.

### 8. Compression blocks the API's only thread

On a real timeline, brotli at quality 9 takes about 25 ms (1,555 KB down to 67 KB), plus about 5 ms
of `JSON.parse`, once per match during a refresh. (Quality 5: 11 ms, 74 KB. Quality 11: 1,440 ms,
51 KB.) Switching `compressJson` to the async `zlib.brotliCompress` moves that work off the main
thread. Small change, small gain.

Status: fixed 2026-09-24. `compressJson` is async (`zlib.brotliCompress`, on libuv's thread pool).
`parseMatch` no longer compresses; `ingestMatch` compresses the match and its timeline side by
side (a real timeline: 39 ms off the main thread, round-trip checked). `backfill-reparse-participants`
no longer pays for compressing blobs it never writes.

## Low / polish

- **Logs come in two formats.** The Riot client (`riotApi/logger.ts`) and the scripts print colored
  text through `console`, with warnings and errors on stderr, while the API logs pino JSON. On
  Railway the Riot and crawler lines can't be filtered by field, and stderr lines show up as
  errors. Route them through pino child loggers.
  Status: fixed 2026-09-24. The Riot client logs through a pino child (`module: "riot"`, its own
  `RIOT_LOG_LEVEL`) with the line's columns as fields under `riot`; the scripts through children
  with `module` and `lane`. Off a terminal every line is JSON on stdout with `level` as a word
  ("warn", "error") for Railway to filter on; in a terminal the lines look as before (pino-pretty,
  `[module] [lane]` prefix). Riot line colors now only apply in a terminal, and Postgres notices
  (printed by the driver outside the logs) are dropped.
- **The queue screen's time estimate is optimistic.** It assumes a constant 2.4 s per match
  (`refreshQueue.ts`, `SECONDS_PER_MATCH`), but the crawler shares the budget. Use the observed rate
  after a few matches, as `progressLogger` in `scripts/script-helpers.ts` already does.
  Status: won't fix (decided with the user 2026-09-24): the crawler won't run in production once
  the site is live, so it won't share the budget there.
- **Deploy ordering.** Only the API runs migrations, and Drizzle's migrator takes no lock. If the
  crawler's new code starts before the API has migrated, the crawler crashes at startup. Wrap
  `runMigrations` in `pg_advisory_lock` and call it from both processes.
  Status: won't fix (decided with the user 2026-09-24): the API is the one that migrates, and the
  crawler won't run in production.
- **Web-to-API reads have no timeout.** `apiFetch` (`apps/web/src/lib/api.ts`) waits forever on the
  non-stream reads, so a hung API hangs page rendering.
  Status: fixed 2026-09-24. A call without its own `signal` times out after 10 s, body included;
  the refresh stream still passes its own. Every caller already turns a failed read into a fallback
  (splash totals, the catalog, the link-preview card) or the page's error.
- **Ping counters are bulky per row.** `match_participants.pings` is jsonb, which repeats all 14 key
  names on every row: 9 MB of the 37 MB table locally (`frames` is 10 MB). Disk is fine, but row
  width is what the recap query reads and what fits in the database's memory cache. A `smallint[]`
  would be about 50 bytes instead of about 330. Only worth doing alongside the next participant
  re-parse.
  Status: fixed 2026-09-24, without a re-parse: migration `0020_pings_smallint_array` converts the
  column in place to a `smallint[]` in `PING_TYPES` order. Locally: 338 bytes down to 49 per row,
  the table 48 MB down to 37 MB, every ping type's total identical before and after, and a
  recap's ping total equal to a direct SQL sum. `frames`: see "Frames" below, not changed.
- **`remap-puuids` won't cope with today's database.** It was sized for about 4,700 players (about
  95 min) and rewrites everything in one transaction, with its own copy of the routing table and
  pacing. With the crawler's growth it would take many hours. Moving to a production key usually
  means a new Riot app, which changes every PUUID: plan to remap only summoners with a recap and
  let the crawler rediscover everyone else.
  Status: script deleted 2026-09-24 (decided with the user: not needed for now). It's in git
  history; CLAUDE.md §2 keeps the PUUID note and the plan above.

## Frames (report only, 2026-09-24, nothing changed)

`match_participants.frames` is now the largest participant column: 10 MB of the 37 MB table
locally, 397 bytes per row on average. It holds about 26 `[t, physical, magical, true]` tuples per
row: 1,623 bytes as jsonb, but Postgres compresses it (pglz) because the whole row is over its
~2 KB threshold (`toast_tuple_target`). 27,270 of 27,342 rows are compressed, still true after the
pings migration made rows ~290 bytes smaller. Measured on 5,000 rows:

| Format | Bytes per row |
|---|---|
| Today: jsonb, compressed by Postgres | 397 |
| Flat `integer[]` | 441 (arrays compress worse) |
| One point per minute, no `t` (`integer[]`) | 331 |
| One point per minute, deltas as varint `bytea` | 108 |

- `t` is redundant: frames come every 60 s give or take 0.6 s, and the damage curve rounds each
  one to its minute anyway. Dropping it saves only ~15%.
- The only large win is per-minute deltas packed as varints (-73%, 10 MB to ~3 MB locally): a
  custom binary codec that SQL can't read, plus a backfill. Deltas don't fit a `smallint[]` (the
  largest per-minute delta seen is 60,389).
- Hidden risk: the 397 bytes depend on the row staying over ~2 KB. If more columns get trimmed and a
  row drops under it, that row's frames are stored uncompressed (about 4x larger).
  `ALTER TABLE match_participants SET (toast_tuple_target = 256)` would make Postgres compress
  them regardless.

Recommendation: leave the format alone for now. The varint codec is worth it only if storage
becomes a real constraint.

## Found after the audit

- **Aborted lobbies were refetched forever.** `skipped_matches` was only a log: ingestion filtered a
  summoner's match list against `matches` alone, so a match Riot reports as aborted
  (`endOfGameResult` other than `GameComplete`, no participants) cost 2 Riot calls every time it
  appeared in someone's history (up to 16 players per lobby, plus every `check-recaps` run).
  Status: fixed 2026-09-23 with a `bad_matches` table (see CLAUDE.md §1).

## Suggested order

2 first (wasted Riot calls; 1 is by design), then 3 and 6 (small changes that stop
silent data loss and whole-refresh failures), then tests and CI (4), then the rest as convenient.
