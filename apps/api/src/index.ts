import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyReply } from "fastify";
import { db } from "./db.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { applyMigrations } from "./migrations.js";
import { healthRoutes } from "./routes/health.js";
import { catalogRoutes } from "./routes/catalog.js";
import { overviewRoutes } from "./routes/overview.js";
import { devRoutes } from "./routes/dev.js";
import { endAllEventStreams } from "./routes/summoners/eventStream.js";
import { summonerRoutes } from "./routes/summoners/index.js";

// No CORS: browsers never call this API directly. The web app's server
// does, over the host's private network (see CLAUDE.md §3).
const app = Fastify({
  loggerInstance: logger,
  // Fastify's own replies to a malformed URL (bad escape, overlong param)
  // echo the URL back; answer with a code only.
  frameworkErrors: (_err, _request, reply) => {
    // Typed for a route's reply schema; this one has none.
    void (reply as FastifyReply).code(400).send({ error: "bad_request" });
  },
});

// Brings the database schema up to date before serving anything. In
// production the pre-deploy command (scripts/migrate.ts) has already run
// them, so this finds nothing; locally it's how `pnpm dev` migrates.
await applyMigrations();
app.log.info("Database migrations applied");

// Only the web app's server may call this API: it sends the shared secret.
// Without this, anyone who could reach the API could pick their own
// rate-limit key (`x-arena-client-ip`) and skip the web app's checks.
// /health stays open for the host's health check.
if (env.API_PROXY_SECRET) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const expected = digest(env.API_PROXY_SECRET);
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    const given = request.headers["x-arena-proxy-secret"];
    if (typeof given !== "string" || !timingSafeEqual(digest(given), expected)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  });
} else {
  app.log.warn(
    "API_PROXY_SECRET is not set: any caller can reach every route and choose its rate-limit key (fine in local dev only)",
  );
}

// Fastify's default reply to a thrown error carries its message, which for a
// failed query is the whole SQL with its parameters. Client errors (4xx,
// e.g. a malformed request) keep theirs; anything else gets a bare 500, the
// details go to the log.
app.setErrorHandler((err: { statusCode?: number; message: string }, request, reply) => {
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  if (status >= 500) request.log.error({ err }, "request failed");
  return reply.code(status).send({ error: status >= 500 ? "internal" : err.message });
});

// The default 404 names the method and URL; nothing reads it.
app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not_found" }));

await app.register(healthRoutes);
await app.register(catalogRoutes);
await app.register(overviewRoutes);
await app.register(devRoutes);
await app.register(summonerRoutes);

// Refresh streams can stay open for as long as a fetch runs: end them first,
// or closing would wait on them until the host kills the process.
app.addHook("preClose", async () => {
  endAllEventStreams();
});

// The connection pool closes with the server, after in-flight requests end.
app.addHook("onClose", async () => {
  await db.$client.end({ timeout: 5 });
});

// A redeploy sends SIGTERM (Ctrl+C sends SIGINT): stop taking requests,
// let the running ones finish, close the pool, exit. The in-memory refresh
// queue is dropped either way; the next visit re-queues.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} received, shutting down`);
    app.close().then(
      () => process.exit(0),
      (err) => {
        app.log.error(err, "Shutdown failed");
        process.exit(1);
      },
    );
  });
}

// "::" accepts IPv6 and IPv4. Railway's private network can be IPv6-only,
// which "0.0.0.0" (IPv4 only) would miss.
await app.listen({ port: env.PORT, host: "::" });
