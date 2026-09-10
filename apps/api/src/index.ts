import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { db } from "./db.js";
import { riot } from "./riot/index.js";
import { healthRoutes } from "./routes/health.js";
import { summonerRoutes } from "./routes/summoners.js";
import { startIngestionLoop } from "./ingestion/pollLoop.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(summonerRoutes);

const stopIngestionLoop = startIngestionLoop(db, riot, env.INGESTION_INTERVAL_MINUTES);

app.addHook("onClose", async () => {
  stopIngestionLoop();
});

await app.listen({ port: env.PORT, host: "0.0.0.0" });
