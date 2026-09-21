import Fastify from "fastify";
import { summonerRoutes } from "../src/routes/_prof.js";
const app = Fastify();
await app.register(summonerRoutes);
const t = performance.now();
const res = await app.inject({ method: "GET", url: "/summoners/by-riot-id/euw1/Sygnano/EUW/stats" });
console.log("status", res.statusCode, "total", Math.round(performance.now() - t));
process.exit(0);
