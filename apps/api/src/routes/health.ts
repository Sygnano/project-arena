import type { FastifyInstance } from "fastify";
import { sql } from "@arena/db";
import { db } from "../db.js";

/** For the host's health check: healthy only if the database answers, so a
 * lost connection takes the instance out of rotation instead of serving
 * errors behind an "ok". */
export async function healthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request, reply) => {
    try {
      await db.execute(sql`select 1`);
      return { status: "ok" };
    } catch (err) {
      app.log.error(err, "Health check: database unreachable");
      reply.code(503);
      return { status: "error", database: "unreachable" };
    }
  });
}
