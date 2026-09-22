import type { FastifyInstance } from "fastify";
import { refreshRoutes } from "./refreshRoutes.js";
import { readRoutes } from "./readRoutes.js";

/**
 * Summoner routes. Reads (`readRoutes.ts`) only touch our database; the
 * refresh stream (`refreshRoutes.ts`) is the one way anything reaches Riot.
 */
export async function summonerRoutes(app: FastifyInstance) {
  await app.register(readRoutes);
  await app.register(refreshRoutes);
}
