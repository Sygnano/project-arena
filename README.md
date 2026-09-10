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

pnpm db:generate   # generate SQL migrations from packages/db/src/schema.ts
pnpm db:migrate    # apply them to DATABASE_URL

pnpm dev           # runs apps/web and apps/api together via Turborepo
```

Add a tracked summoner (friend-group ingestion is an admin action, not public self-serve — see
CLAUDE.md §1):

```bash
curl -X POST http://localhost:3001/summoners \
  -H "Content-Type: application/json" \
  -d '{"gameName":"Sygnano","tagLine":"EUW","region":"euw1"}'
```
