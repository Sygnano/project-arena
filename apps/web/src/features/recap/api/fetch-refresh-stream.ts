import "server-only";
import { apiFetch } from "@/lib/api-client";
import { summonerApiPath } from "./summoner-api-path";

/** The API's refresh stream, for the proxy route: a server-sent event stream. */
function fetchRefreshStream(
  region: string,
  gameName: string,
  tagLine: string,
  { visitorIp, signal }: { visitorIp: string | null; signal: AbortSignal },
) {
  return apiFetch(`${summonerApiPath(region, gameName, tagLine)}/refresh`, { method: "POST", visitorIp, signal });
}

export { fetchRefreshStream };
