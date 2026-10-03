# packages/db

Drizzle schema (`src/schema.ts`, the single source of truth for match, team and participant
shapes: don't hand-write parallel interfaces in `packages/types`), migrations (`drizzle/`), the
client, and the parsers (`parseMatch`, `parseRounds`). The parsers live here so backfill scripts
can re-derive rows from the stored blobs without calling Riot. Riot/Arena data facts:
`.claude/rules/arena-data.md`.

- Only this package depends on `drizzle-orm`. `src/index.ts` re-exports the helpers others need
  (`eq`, `and`, `sql`, ...): add an export there, never a `drizzle-orm` dependency elsewhere (pnpm
  mislinks the second copy and `tsc` reports "Cannot find module 'drizzle-orm'").
- `matches.raw` and `matches.timeline` are brotli-compressed `bytea`: write with
  `compressJson()`, read with `decompressJson()`, never a plain object. They can't be queried in
  SQL; a feature that needs to query into them gets a derived table.
- Store only what a page reads; the blobs are the archive. Check `TRIMMED_DATA.md` before adding
  a column, and add to it when you drop one.
- `pings` is a smallint array in `PING_TYPES` order: append new types, never reorder.
- Each team member's row carries its own `team_id`; team size is derived from the rows.

## Inspecting real data

- `pnpm --filter @arena/db query "<sql>"`: read-only transaction, 30 s timeout, first 200 rows.
- `pnpm --filter @arena/db match-json <matchId> [outDir]`: writes the decompressed raw and
  timeline JSON to files and prints their paths.

## Changing the schema

1. Edit `src/schema.ts`, then run `pnpm db:generate`. Don't hand-edit `drizzle/meta/`.
2. Read the generated SQL. A migration that rewrites a big table (`match_participants` holds
   millions of rows) runs in Railway's pre-deploy with a 30 s `lock_timeout`: stop the crawler
   and cron services before deploying it.
3. A new parsed column: update `parseMatch.ts`, then `backfill-reparse-participants` (re-derives
   `match_participants` and bans from the blobs). After changing `parseRounds.ts`, run
   `backfill-rounds`.
4. A dropped column: add it to `TRIMMED_DATA.md`.
5. Locally the API applies pending migrations at startup; `pnpm db:migrate` applies them alone.

## Tests

`src/*.test.ts` (Vitest). `src/fixtures/` holds one real Arena match (raw + timeline) with PUUIDs
and player names replaced: the repository is public, so never commit real ones.
