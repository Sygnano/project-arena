import Fastify from "fastify";
import { runMigrations } from "@arena/db";
import { db } from "./db.js";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { healthRoutes } from "./routes/health.js";
import { catalogRoutes } from "./routes/catalog.js";
import { overviewRoutes } from "./routes/overview.js";
import { devRoutes } from "./routes/dev.js";
import { endAllEventStreams } from "./routes/summoners/eventStream.js";
import { summonerRoutes } from "./routes/summoners/index.js";

// No CORS: browsers never call this API directly. The web app's server
// does, over the host's private network (see CLAUDE.md §3).
const app = Fastify({ loggerInstance: logger });

// Brings the database schema up to date before serving anything: this is
// how a deploy applies new migrations.
await runMigrations(db);
app.log.info("Database migrations applied");

// Fastify's default reply to a thrown error carries its message, which for a
// failed query is the whole SQL with its parameters. Client errors (4xx,
// e.g. a malformed request) keep theirs; anything else gets a bare 500, the
// details go to the log.
app.setErrorHandler((err: { statusCode?: number; message: string }, request, reply) => {
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  if (status >= 500) request.log.error({ err }, "request failed");
  return reply.code(status).send({ error: status >= 500 ? "internal" : err.message });
});

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
