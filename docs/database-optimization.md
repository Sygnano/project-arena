# Database optimization: findings

Measured on the hosted (Railway) database on 2026-10-03, before moving the raw match data to a
local `arena_archive` database. Sizes come from `pg_class`/`pg_stats` and `pg_column_size` on a
0.05% `tablesample` of `match_participants`.

## Where the space goes

Whole database: 88 GB. `matches.raw` (9.9 GB) and `matches.timeline` (52 GB) move to
`arena_archive` as they are (already brotli-compressed, kept 1:1). What stays in `arena`, about
23.5 GB:

| Table                | Rows   | Heap    | Indexes | Total   | Notes                                              |
| -------------------- | ------ | ------- | ------- | ------- | -------------------------------------------------- |
| `match_participants` | 14.85M | 17 GB   | 2.6 GB  | 20 GB   | about 1,160 bytes a row                            |
| `match_rounds`       | 24M    | 1.4 GB  | 1.3 GB  | 2.7 GB  | 60 bytes a row, mostly per-row overhead            |
| `summoners`          | 1.6M   | 278 MB  | 331 MB  | 609 MB  | every participant has a row; 0.3% have a recap     |
| `matches` (light)    | 800k   | 162 MB  | 32 MB   | ~200 MB | `banned_champion_ids` is 93 bytes, `-1` = no ban   |

Indexes: `match_participants` primary key (`match_id`, `puuid`) is 2.3 GB, `match_participants_puuid_idx`
363 MB, `match_rounds` primary key 1.3 GB, `summoners_pkey` 222 MB.

### Inside a `match_participants` row

| Column(s)                         | Bytes | Content                                                        |
| --------------------------------- | ----- | -------------------------------------------------------------- |
| `frames`                          | 429   | jsonb `[[60031, 881, 120, 0], …]`: ~29 frames of `[ms, phys, magic, true]`, cumulative |
| `purchased_item_ids`              | 144   | jsonb array of item ids                                        |
| `items`                           | 109   | jsonb, 7 slots including `0` (empty) and trinket `3348`        |
| `puuid`                           | 79    | 78-character text, also in the primary key and its own index   |
| `augments`                        | 58    | jsonb `[48, 30, 345, 301]`                                      |
| `pings`                           | 49    | `smallint[14]`, highest count seen 50                           |
| `boots_bought`, `boots_sold`      | 28    | jsonb, often `[]`                                               |
| `riot_id_game_name`, `riot_id_tagline`, `champion_name` | ~22 | copies: `summoners` has every participant's name (3.5% of sampled rows differ: renamed since), the catalog has champion names |
| 45 integer/boolean columns        | ~180  | many bounded well under 32,767 (kills, casts, multikills)      |

The API reads all of these whole and processes them in JavaScript (no jsonb operators in SQL), so
most changes below are a column type plus decoding, not query rewrites. `match_rounds.round_number`
is never read: `loadStatsData` selects only `winner_team_id` and `loser_team_id`.

## Candidates

| # | Change                                                                                   | Saves      | Code impact                                                     |
| - | ---------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------- |
| 1 | `frames` → packed `bytea`: per-minute deltas as varints, ms timestamps dropped (frame index = minute) | ~3.7 GB | encode in `parseMatch`, decode in the damage-curve section |
| 2 | `puuid` → `summoner_id integer`, a surrogate key on `summoners`                          | ~3 GB      | invasive: ingestion, every puuid lookup, the stats loader       |
| 3 | `match_rounds` → one array column on `matches` (`winner, loser` pairs in round order)    | ~2.5 GB    | ingestion, `loadStatsData`, `people.ts`, `backfill-rounds`      |
| 4 | jsonb arrays (`items`, `purchased_item_ids`, `augments`, `boots_*`) → `integer[]`        | ~2.2 GB    | type only: Drizzle returns the same JS arrays                   |
| 5 | Bounded `integer` columns → `smallint`, columns reordered against alignment padding       | ~0.9 GB    | schema only; check each column's maximum first                  |
| 6 | `pings` → 14-byte `bytea`                                                                | ~0.5 GB    | decode; assumes counts ≤ 255                                    |
| 7 | Drop participant name/tagline, join `summoners`                                           | ~250 MB    | behavior change: pages show current names                       |
| 8 | Drop `champion_name` (the catalog has it)                                                | ~100 MB    | `buildSummonerStats`                                            |

Estimates: 1 + 3 + 4 take `arena` from ~23.5 GB to ~15 GB; adding 2 to ~12 GB.

## What was done (2026-10-07)

The hosted database was copied 1:1 to local Postgres over the Railway SSH tunnel (resumable
batches; a single `pg_dump` could not survive hours without a network drop), verified row by row,
then reshaped locally:

| Step | Migration | Result |
| ---- | --------- | ------ |
| `raw`/`timeline` to the `arena_archive` database; `matches.region` dropped (the match id's prefix) | `0021_raw_to_archive`, `drizzle-archive/0000_archived_matches` | `arena` 88 GB → 23 GB |
| Candidates 1, 3, 4: `frames` packed `bytea` (135 bytes a row against 440), `match_rounds` folded into `matches.rounds`, jsonb id lists to `integer[]` | `0022_storage_optimizations` | → 13 GB (`match_participants` 19 → 12 GB) |
| `n_distinct` pinned on `match_participants.match_id`/`puuid` (ANALYZE's page sampling underestimated them 15×, and the smaller table tipped big recaps into full scans) | `0023_planner_distinct_counts` | |

Checks: the archive's blobs match the originals by MD5, every one; six real recaps (229 to 2,156
games) are byte-identical before and after; 500 matches re-derived from the archive with the new
parsers equal the migrated rows (frames, rounds, items, augments, purchases, boots).

Not done, by decision: 2 (puuid surrogate key), 5 (smallint), 6 (pings), 7 (names), 8
(`champion_name`). The database now runs locally, so size matters less than it did on Railway.

Next: run the apps against the local databases, then reach them from Railway through a tunnel.
