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

## Recommendation

- First pass: 1, 3, 4 (mostly mechanical), and 8.
- Second pass, after measuring: 2 and 5.
- 6 and 7 only if still worth it; 7 changes what pages show.
- `arena_archive` stays 1:1.

## Raw data split: target layout (discussed, to settle before writing the migrations)

- `arena`: `summoners`, `match_participants`, `match_rounds`, `bad_matches`, `skipped_matches`,
  Drizzle's migrations table. `arena_archive`: one `matches` table, `match_id`, `raw`, `timeline`.
- Open: `matches` also holds `game_creation` (orders a summoner's games, gives recap dates) and
  `banned_champion_ids` (the bans section), and `match_participants`/`match_rounds` have foreign
  keys to it. Options: (a) keep a slim `matches` in `arena` with those two columns (~150 MB,
  foreign keys kept; recommended), (b) copy them onto every participant row (18 copies a match,
  no foreign keys), (c) re-derive from the archive (the archive would then be read at runtime).
- `region` can go: it is the `match_id` prefix (`VN2_…` → `vn2`).
- To confirm: the archive keeps `timeline` (raw Riot data too, 52 of its 62 GB).
- Today's migrations create the current shape. `arena` needs a `schema.ts` change plus a new
  migration; `arena_archive` needs its own Drizzle schema, config and migrations folder in
  `packages/db`. Ingestion then writes the blobs to the archive (a later step).

## Order of work

1. Copy the hosted database 1:1 into the local `arena`
   (`packages/db/scripts/pull-from-railway.ts`: primary-key batches over the Railway SSH tunnel,
   resumable, free of egress charges). A single `pg_dump` failed twice: the 66 GB `matches` copy
   can't survive hours without one network drop.
2. Settle the layout above, write the schema changes and migrations, split the raw data out.
3. Apply the optimizations, measure, push the light database to a new Railway Postgres.

## How to apply

Load `arena` in the hosted shape (`packages/db/scripts/pull-from-railway.ts`), then convert it
locally with Drizzle migrations, so each change is tried on real data without re-downloading
and the same migrations ship with the code. The light database pushed back to Railway is a dump
of the converted local one.
