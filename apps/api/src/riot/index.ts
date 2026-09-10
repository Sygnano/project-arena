import { env } from "../env.js";
import { RiotClient } from "./client.js";

export const riot = new RiotClient(env.RIOT_API_KEY);
export { RiotClient, RiotApiError } from "./client.js";
