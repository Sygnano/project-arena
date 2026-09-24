import type { FastifyInstance } from "fastify";
import { scheduler } from "../riot.js";

/** `/health` (open, for the host's health check) and `/status` (what waits where). */
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async () => ({ status: "ok" }));

  // Requests waiting per Riot host and priority bucket: hosts with none are left out.
  app.get("/status", async () => ({ waiting: scheduler.snapshot() }));
}
