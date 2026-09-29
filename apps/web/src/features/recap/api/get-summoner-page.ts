import "server-only";
import type { SummonerPageData } from "@arena/types";
import { apiFetch } from "@/lib/api-client";
import { summonerApiPath } from "./summoner-api-path";

/** The stored summoner and their fetch in progress. Null when the Riot ID
 * isn't stored yet (the page then offers to fetch it). Database only. */
async function getSummonerPage(region: string, gameName: string, tagLine: string): Promise<SummonerPageData | null> {
  const res = await apiFetch(summonerApiPath(region, gameName, tagLine));
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Failed to load the summoner (${res.status})`);
  return res.json();
}

export { getSummonerPage };
