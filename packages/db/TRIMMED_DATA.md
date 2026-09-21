# Trimmed database data

A record of the data we stopped storing because nothing read it. Before storing a new
field, check whether it is listed here and why it was dropped.

**Rule used:** a column counts as *used* only if its value reaches the summoner page, or if a
maintenance script needs it to rebuild other data. A column that the API selected but the web app
never rendered counts as unused.

**Everything below can be recovered.** `matches.raw` (the full Match-V5 payload) and
`matches.timeline` are kept on purpose. Any trimmed participant, match or frame field can be
brought back by adding the column again, restoring its line in `parseMatch.ts`, and running
`pnpm --filter @arena/db backfill-reparse-participants` (or `backfill-rounds` for
`match_rounds`). This does not call Riot again. The two exceptions are `summoners.tracked_since`
and `matches.ingested_at`, which were bookkeeping timestamps with no copy in Riot's data.

## Trim of 2026-09-19

The audit covered every column of `summoners`, `matches`, `match_participants` and
`match_rounds`. It traced each column through `apps/api` (queries and the stats response) and
`apps/web` (what gets rendered). It was measured on 345 matches, 6,210 participant rows and
10,695 rounds.

### Dropped columns

| Table | Column | Why it was unused |
|---|---|---|
| `summoners` | `tracked_since` | Never read. The crawler orders by `last_refreshed_at` instead. |
| `matches` | `queue_id` | Never read. The Arena queue filter is applied when match ids are fetched from Riot, so every stored match is already Arena. |
| `matches` | `game_duration_seconds` | Never read. Stats use `match_participants.time_played_seconds`, which accounts for teams knocked out early (CLAUDE.md §2). |
| `matches` | `patch` | Never read. There are no per-patch stats yet. |
| `matches` | `ingested_at` | Never read. |
| `match_participants` | `champ_level` | Never read. |
| `match_participants` | `win` | Never read. On this site a "win" means a top-3 finish, computed from `placement`. Riot's own `win` flag is not used. |
| `match_participants` | `killing_sprees` | The API summed it, but the page never showed it. It is also always `0` in Arena (CLAUDE.md §2). |
| `match_participants` | `largest_multi_kill` | The API sent it (as `kills.largestMultiKill` and `combat.largestMultiKill`), but the page never rendered it. |
| `match_participants` | `total_time_spent_dead` | Never read, and Riot's value is unreliable in Arena (it exceeds time played on 21.6% of rows, CLAUDE.md §2). |
| `match_rounds` | `ended_at_ms` | Never read. The round order is already in `round_number`. |

### Slimmed: `match_participants.frames`

Each timeline frame used to store 11 fields: `t, gold, xp, level, x, y, dmgToChamps, dmgPhys,
dmgMagic, dmgTrue, dmgTaken`. Only the damage curve reads this column, and it uses 4 of them.
Frames are now stored as tuples: `[t, dmgPhys, dmgMagic, dmgTrue]`.

- Dropped: `gold`, `xp`, `level`, `x`, `y` (these were meant for gold curves and death heatmaps
  that were never built), `dmgToChamps` (equal to the sum of the three splits, give or take 0-2
  from Riot's rounding), and `dmgTaken`.
- Size: 6.4 MB went down to 2.5 MB after Postgres compression, a 60% cut. Before the trim,
  `frames` was the largest participant column (about 1 KB per row).

### Checked and kept

These columns looked like trim candidates but are used:

- `matches.raw`, `matches.timeline`: the app never reads them, but `backfill-reparse-participants`,
  `backfill-rounds` and `remap-puuids` rebuild everything else from them. They were kept by
  decision. Together they are about 80 KB of each match's stored size.
- `matches.region`: `apps/api/scripts/backfill-missing-timelines.ts` needs it to fetch from the right Riot cluster.
- `match_participants.riot_id_game_name` / `riot_id_tagline`: used for teammate and opponent names. The crawler also uses them to discover new summoners.
- `consumables_purchased`, `items_purchased`, `first_blood_kill`, `first_blood_assist`,
  `flawless_aces`, `largest_critical_strike`, `cc_total_time_dealt`, `skillshots_hit`,
  `skillshots_dodged`, `fist_bumps`, `damage_self_mitigated`: each one is rendered somewhere
  (Vault, Kills, Utility, the champion dossier, the Ability and fun slides).
- `pings` (1.6 MB, the second-largest participant column): all 14 counters are shown on the
  Pings slide.

### Storage after the trim

Most of what's left is the kept blobs:

| Per match | Size |
|---|---|
| `matches.timeline` (brotli) | ~68 KB |
| `matches.raw` (brotli) | ~13 KB |
| 18 `match_participants` rows | ~60 KB (was ~75 KB) |
| `match_rounds` | ~3 KB |

The crawler ingests about 1,500 matches per hour at dev-key rate limits, which adds roughly
200 MB per hour. On a free-tier Postgres plan, watch the database size while it runs.

Dropping a column doesn't shrink files on disk by itself. Postgres only reclaims the space after
a `VACUUM FULL` (see the note in the migration).
