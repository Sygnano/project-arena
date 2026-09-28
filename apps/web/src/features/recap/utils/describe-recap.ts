import type { SummonerView } from "@arena/types";
import { formatUtcDateTime } from "@/utils/format";
import { platformRegionName } from "@/utils/riot";

/** The link preview's text: always says when the matches were last fetched. */
function describeRecap(summoner: SummonerView | null, platform: string): string {
  const server = platformRegionName(platform);
  if (!summoner?.lastRefreshedAt) {
    return `Arena season recap on ${server}. Last updated: never. Open the link to fetch their matches.`;
  }
  const games = `${summoner.matchCount.toLocaleString("en-US")} Arena ${summoner.matchCount === 1 ? "game" : "games"}`;
  return `${games} on ${server}. Last updated ${formatUtcDateTime(summoner.lastRefreshedAt)}.`;
}

export { describeRecap };
