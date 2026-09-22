# Arena Stats

League of Legends Arena mode stats for the crew. See [CLAUDE.md](./CLAUDE.md) for the full
product scope, architecture decisions, and domain-model notes — read it before making structural
changes.

## Layout

- `apps/web` — Next.js frontend (App Router, shadcn/ui, Hextech theme).
- `apps/api` — Fastify API + Riot API ingestion worker.
- `packages/db` — Drizzle Postgres schema + client, shared by `apps/api`.
- `packages/types` — Shared Riot API DTO shapes.

## Getting started

```bash
pnpm install

# apps/api needs a Postgres connection string and a Riot API key:
cp apps/api/.env.example apps/api/.env
# then edit apps/api/.env

pnpm dev           # runs apps/web and apps/api together via Turborepo
```

The API applies pending database migrations itself when it starts. After changing
`packages/db/src/schema.ts`, run `pnpm db:generate` to write the new migration.

Search any Riot ID on the splash page (http://localhost:3000) to start tracking it. Bulk
ingestion is the hand-run crawler: `pnpm --filter @arena/api crawl` (see CLAUDE.md §1).
