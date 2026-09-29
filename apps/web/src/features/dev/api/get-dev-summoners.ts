import "server-only";
import type { DevSummonerList } from "@arena/types";
import { apiFetch } from "@/lib/api-client";

/** Summoners with a recap, latest refresh first, for the /dev page, and
 * when the list was read (what its "ago" times count from). */
async function getDevSummoners(): Promise<DevSummonerList & { readAt: number }> {
  const res = await apiFetch("/dev/summoners");
  if (!res.ok) throw new Error(`Failed to load the summoner list (${res.status})`);
  return { ...((await res.json()) as DevSummonerList), readAt: Date.now() };
}

export { getDevSummoners };
