import type { FastifyInstance } from "fastify";
import { getGameCatalogJson } from "../leagueData/index.js";

/** Catalog changes only with a patch, and the process caches it until restart. */
const MAX_AGE_SECONDS = 60 * 60;

/** `GET /catalog`: champion, item and augment names and icons (`GameCatalog`),
 * which recaps reference by id. */
export async function catalogRoutes(app: FastifyInstance) {
  app.get("/catalog", async (_request, reply) =>
    reply
      .type("application/json; charset=utf-8")
      .header("cache-control", `public, max-age=${MAX_AGE_SECONDS}`)
      .send(await getGameCatalogJson()),
  );
}
