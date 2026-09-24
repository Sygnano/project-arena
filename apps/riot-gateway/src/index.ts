import { createHash, timingSafeEqual } from "node:crypto";
import Fastify, { LogController, type FastifyReply } from "fastify";
import { GATEWAY_SECRET_HEADER } from "@arena/riot";
import { env } from "./env.js";
import { logger } from "./logger.js";
import { healthRoutes } from "./routes/health.js";
import { riotRoutes } from "./routes/riotRoutes.js";
import { endAllEventStreams } from "./sse.js";

/**
 * The Riot gateway: the only process that talks to Riot. It holds the API
 * key, keeps each Riot host's rate limits, and sends requests in priority
 * order (see README.md). No CORS and no public domain: only the API and its
 * scripts call it, over the host's private network.
 */
const app = Fastify({
  loggerInstance: logger,
  // Request logs would repeat every Riot line; the Riot logger has them.
  logController: new LogController({ disableRequestLogging: true }),
  frameworkErrors: (_err, _request, reply) => {
    void (reply as FastifyReply).code(400).send({ error: "bad_request" });
  },
});

// Only our own services may spend the key's budget, and the priority header
// is theirs to set: they send the shared secret. /health stays open.
if (env.RIOT_GATEWAY_SECRET) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  const expected = digest(env.RIOT_GATEWAY_SECRET);
  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    const given = request.headers[GATEWAY_SECRET_HEADER];
    if (typeof given !== "string" || !timingSafeEqual(digest(given), expected)) {
      return reply.code(403).send({ error: "forbidden" });
    }
  });
} else {
  app.log.warn(
    "RIOT_GATEWAY_SECRET is not set: any caller can spend the Riot key's budget at any priority (fine in local dev only)",
  );
}

app.setErrorHandler((err: { statusCode?: number; message: string }, request, reply) => {
  const status = err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? err.statusCode : 500;
  if (status >= 500) request.log.error({ err }, "request failed");
  return reply.code(status).send({ error: status >= 500 ? "internal" : err.message });
});

app.setNotFoundHandler((_request, reply) => reply.code(404).send({ error: "not_found" }));

await app.register(healthRoutes);
await app.register(riotRoutes);

// Waiting requests would hold the server open: end their streams, and their
// callers retry against the next instance.
app.addHook("preClose", async () => {
  endAllEventStreams();
});

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

// "::" accepts IPv6 and IPv4 (Railway's private network can be IPv6-only).
await app.listen({ port: env.PORT, host: "::" });
