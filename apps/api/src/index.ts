import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { summonerRoutes } from "./routes/summoners.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: true });
await app.register(healthRoutes);
await app.register(summonerRoutes);

await app.listen({ port: env.PORT, host: "0.0.0.0" });
