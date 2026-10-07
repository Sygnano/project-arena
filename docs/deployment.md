# Deployment (Railway)

Every service runs in one Railway project, built by Railpack from the whole repository (no
Dockerfile). Only the web app has a public domain; the others talk over Railway's private
network, which isn't billed and can be IPv6-only.

## Services

The backend runs as esbuild bundles (`packages/bundle`: workspace packages and npm dependencies
in one minified `.mjs` with a source map; pino stays external) under plain `node`. Locally,
`dev` and the by-hand script commands run the TypeScript source through `tsx`; `start` runs the
bundle.

| Service              | `RAILPACK_INSTALL_CMD`                                           | Build command                                                              | Pre-deploy command                                            | Start command                                                                 |
| -------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| api                  | `pnpm install --frozen-lockfile --filter @arena/api...`          | `pnpm --filter @arena/api build && pnpm --filter @arena/api build:scripts` | `node --enable-source-maps apps/api/dist/scripts/migrate.mjs` | `node --enable-source-maps apps/api/dist/index.mjs`                           |
| crawler              | same as api                                                      | `pnpm --filter @arena/api build:scripts`                                   | none                                                          | `node --enable-source-maps apps/api/dist/scripts/crawl.mjs --forever`         |
| crawler-leaderboard  | same as api                                                      | `pnpm --filter @arena/api build:scripts`                                   | none                                                          | `node --enable-source-maps apps/api/dist/scripts/crawl-leaderboard.mjs`       |
| retry-skipped (cron) | same as api                                                      | `pnpm --filter @arena/api build:scripts`                                   | none                                                          | `node --enable-source-maps apps/api/dist/scripts/retry-skipped.mjs`           |
| riot-gateway         | `pnpm install --frozen-lockfile --filter @arena/riot-gateway...` | `pnpm --filter @arena/riot-gateway build`                                  | none                                                          | `node --enable-source-maps apps/riot-gateway/dist/index.mjs`                  |

- Builds and start commands are set in the dashboard (Railway's config-as-code files are
  deprecated). The cron schedule for `retry-skipped` is set there too.
- Watch paths for backend services: `apps/api/**` (or `apps/riot-gateway/**`) plus `packages/**`,
  `pnpm-lock.yaml`, `package.json`, `pnpm-workspace.yaml`, so a web-only change doesn't redeploy
  them.
- `RAILPACK_NODE_VERSION=24` on every service (`engines.node` only says `>=22`). CI uses the
  same major.

## Migrations

- Run in the api service's pre-deploy command (`apps/api/scripts/migrate.ts`), after the build
  and before the new container starts, with no health-check window. A big table rewrite at
  startup outlasted the 60 s health check and rolled back on every deploy.
- Both pre-deploy and startup go through `applyMigrations` (`apps/api/src/migrations.ts`): its
  own connection (`MIGRATION_DATABASE_URL`, else `DATABASE_URL`), no statement timeout, a 30 s
  `lock_timeout`. The API still calls it at startup: a no-op after pre-deploy, and how `pnpm dev`
  migrates locally. The builds copy the SQL to `dist/drizzle`.
- A migration waiting for a lock queues every query on that table behind it, live recap reads
  included: stop the crawler and cron services before deploying a migration that rewrites a
  table they write.

## Environment variables

| Service                    | Variables                                                                                                                                                                                          |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| web                        | `API_URL` (`http://${{api.RAILWAY_PRIVATE_DOMAIN}}:<port>`, server-side only), `SITE_URL` (its public origin, the root layout's `metadataBase`; without it link previews point at localhost), `API_PROXY_SECRET`, optional `MAINTENANCE_MODE` |
| api                        | `DATABASE_URL`, optional `ARCHIVE_DATABASE_URL` (default: `arena_archive` on `DATABASE_URL`'s server), optional `MIGRATION_DATABASE_URL`, `API_PROXY_SECRET` (same value as web, 32+ characters), `RIOT_GATEWAY_URL`, `RIOT_GATEWAY_SECRET`, optional `STATS_CACHE_MAX_MB` / `STATS_CACHE_RECENT_MB`, optional `MAINTENANCE_MODE` |
| crawler, crawler-leaderboard, retry-skipped | `DATABASE_URL`, optional `ARCHIVE_DATABASE_URL`, `RIOT_GATEWAY_URL`, `RIOT_GATEWAY_SECRET`                                                                                                                         |
| riot-gateway               | `RIOT_API_KEY`, `PORT=3002`, `RIOT_GATEWAY_SECRET` (32+ characters)                                                                                                                                |

- `RIOT_GATEWAY_URL=http://${{riot-gateway.RAILWAY_PRIVATE_DOMAIN}}:3002`: private network only;
  a public domain would bill every timeline as egress.
- `DATABASE_URL` should be a role that can only read and write rows, with migrations through
  `MIGRATION_DATABASE_URL` (a role owning the schema). Railway's default `postgres` user is a
  superuser, so any SQL injection would otherwise reach the whole server.
- `MAINTENANCE_MODE=true` (a shared variable referenced by web and api, so one switch sets both):
  web redirects every page to `/maintenance` and its API routes answer 503; the API answers 503
  on every route but `/health` (200 `maintenance`) and skips migrations, so it runs without a
  database. Pause the crawler and cron services yourself.
- Health check paths: web `/robots.txt`, api `/health`. Both stay 200 in maintenance; a web
  health check path must be left out of `apps/web/src/proxy.ts`'s matcher, or it gets the redirect.
- Each app's `.env.example` lists its variables for local development.

## Runtime behavior worth knowing

- The API listens on `::`, closes cleanly on SIGTERM, and `/health` answers 503 when the database
  doesn't answer. A deploy restarts the process, which clears the stats cache and the in-memory
  refresh queue (pressing again re-queues).
- Exactly one riot-gateway instance: its rate-limit state is in memory.
- The crawlers run next to the live site for good; their Riot calls wait in the gateway's lowest
  bucket, so they spend only what the site leaves.
