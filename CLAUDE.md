# Arena Stats

League of Legends **Arena** stats: a Spotify-Wrapped-style season recap per summoner, built from
our own Postgres database, which a crawler keeps filling. Built for a friend group with open Riot
ID search; heading for a public build on a production Riot key. Deployed on Railway.

Every rule in this file and in the scoped files below is a decision made with the user. Don't
reverse one without asking. If a change makes a rule false, update the rule in the same change.

## Where things are

Scoped instructions load on their own when you open files in their folder.

| Path                                    | What                                                                                           | Instructions                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------- |
| `apps/web`                              | Next.js 16 App Router, Bulletproof React (lint-enforced), shadcn/ui + Tailwind v4              | `apps/web/CLAUDE.md`             |
| `apps/api`                              | Fastify API, refresh stream and queue, crawlers and maintenance scripts                        | `apps/api/CLAUDE.md`             |
| `apps/riot-gateway`                     | The only process holding `RIOT_API_KEY`: Riot rate limits and priority buckets                 | `apps/riot-gateway/CLAUDE.md`    |
| `packages/db`                           | Drizzle schema, migrations, client, `parseMatch`/`parseRounds`, backfill scripts               | `packages/db/CLAUDE.md`          |
| `packages/riot`                         | Platforms/clusters routing, queue ids, priority buckets, gateway wire protocol and client      |                                  |
| `packages/types`                        | Shared DTOs Drizzle doesn't infer (Riot payloads, recap payload, catalog, refresh events)      |                                  |
| `packages/bundle`                       | esbuild bundler for the backend deploys                                                        |                                  |
| Riot/Arena data facts                   | Payload quirks, item/augment rules, what Riot data is wrong                                    | `.claude/rules/arena-data.md`    |
| Deployment                              | Railway services, migrations, env vars                                                         | `docs/deployment.md`             |

## Commands

- `pnpm dev`: web :3000, api :3001, gateway :3002 (one alone: `pnpm dev:web`, `dev:api`,
  `dev:gateway`). Needs the local Postgres 18 Windows service
  `postgresql-x64-18` (role `arena`, databases `arena` and `arena_archive`), plus `.env` files
  from each `.env.example`.
- `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm format`: Turbo-cached. `lint` is `biome check`
  (format, import order, lint rules); `format` applies its fixes. A Stop hook runs
  typecheck, lint and test when code changed, and Biome formats every file Claude writes.
- `pnpm db:generate` after editing `packages/db/src/schema.ts`.
- `pnpm --filter @arena/db query "<sql>"`: read-only SQL against the local database.
- `pnpm --filter @arena/db match-json <matchId>`: one match's decompressed raw + timeline JSON.
- `pnpm script:api <file> [args]`: runs `apps/api/scripts/<file>.ts` with apps/api's `.env`
  (`pnpm script:api crawl --forever`); without a name, lists them.
- `node apps/web/scripts/screenshot.mjs summoner/<platform>/<Name-TAG>`: screenshots a page of
  the running dev server at the four viewports a slide must fit (no leading slash in Git Bash).
- Adding a stat to the recap, end to end: the `add-recap-stat` skill.
- Production build beside a running dev server: `NEXT_DIST_DIR=.next-build pnpm build`, then
  revert the `include` change `next build` makes to `apps/web/tsconfig.json`.

## Invariants

- **Never hardcode Arena team size** (teams of 3 now, 2 before) or team count: in the schema,
  ingestion and stats, both come from each match's own rows. No fixed teammate tuples.
- **Every Riot call goes through the Riot gateway.** Every Riot call a visitor causes goes
  through the summoner refresh stream; page reads, searches and stats only read our database. A
  summoner's first full fetch only ever starts from a click.
- **PUUIDs and raw error messages never leave the server** (Riot's policies; they also made the
  database easy to crawl).
- **Store only what a page reads.** Riot's payloads (brotli `raw`/`timeline`) live in a second
  database, `arena_archive`, the archive any dropped field can be re-derived from; nothing a page
  reads touches it. Check `packages/db/TRIMMED_DATA.md` before adding a column.
- **Only `packages/db` depends on `drizzle-orm`**: import `eq`, `and`, `sql`... from `@arena/db`.
- **No auth, accounts or sessions**, and no speculative infrastructure for them.
- **A recap sends ids**; names and icons come from the game catalog (`GET /catalog`).
- **"Win" means a top-3 finish** (say WIN / WINRATE / WIN %, never "TOP 3"); 1ST / 1ST RATE is
  first place.
- **Riot Arena's queue id is a parameter** (`Queue.ARENA`), never a literal: Riot has changed it.
- **The crawler only does discovery**: judge any change to it by matches stored per Riot call.
- SEO is not a goal: no sitemap or metadata tuning work unless asked.

## Conventions

- Biome for formatting (120 columns), import order and lint, one root task over the whole repo.
  Every rule lives in the root `biome.jsonc`, scoped by `overrides`; no nested Biome configs. An
  env var a task reads is declared in that package's `turbo.json` (`noUndeclaredEnvVars` warns).- No `packages/ui` until a second app needs the components.
- Tests use Vitest, next to the code (`*.test.ts`). Pure logic with domain rules (parsers, rate
  helpers, key functions) gets a test when it changes.
- Commit messages: an imperative summary under 72 characters, then a body that says why. The
  reasoning and history of a decision belong there, not in these instruction files.
- Instruction files state the current rule in one to three lines, in the scoped file for its
  area. No dates, no "how we got here", no measurements unless the number is the rule.
- For structural choices, research current best practice (framework docs first) and apply it,
  naming the sources. Keep the user's explicit choices where a source disagrees, and say so.
