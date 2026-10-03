# Arena Stats

League of Legends Arena stats: a season recap per summoner, in the style of Spotify Wrapped,
built from matches a crawler keeps collecting. [CLAUDE.md](./CLAUDE.md) holds the project's rules
and points to the instructions for each part.

## Layout

| Path                     | What                                                                        |
| ------------------------ | --------------------------------------------------------------------------- |
| `apps/web`               | Next.js frontend (App Router, shadcn/ui, Hextech theme)                     |
| `apps/api`               | Fastify API, refresh queue, crawlers and maintenance scripts                |
| `apps/riot-gateway`      | The only service holding the Riot API key: rate limits and priority buckets |
| `packages/db`            | Drizzle schema, migrations and match parsers                                |
| `packages/riot`          | Riot routing, queue ids and the gateway client                              |
| `packages/types`         | Shared DTO types                                                            |
| `packages/bundle`        | esbuild bundler for the backend deploys                                     |

## Getting started

Needs Node 22+ (24 in production), pnpm 12 and a local Postgres with a database `arena`.

```bash
pnpm install
cp apps/api/.env.example apps/api/.env                   # DATABASE_URL
cp apps/riot-gateway/.env.example apps/riot-gateway/.env # RIOT_API_KEY
cp packages/db/.env.example packages/db/.env             # DATABASE_URL, for db scripts
pnpm dev                                                 # web :3000, api :3001, gateway :3002
```

The API applies pending migrations when it starts. After changing `packages/db/src/schema.ts`,
run `pnpm db:generate` to write the new migration.

Search any Riot ID on http://localhost:3000. To fill the database in bulk, run the crawler:
`pnpm --filter @arena/api crawl`.

## Checks

```bash
pnpm lint && pnpm typecheck && pnpm test   # lint: Biome (format, import order, lint rules)
```

CI runs the same on every push and pull request. Deployment: [docs/deployment.md](./docs/deployment.md).
