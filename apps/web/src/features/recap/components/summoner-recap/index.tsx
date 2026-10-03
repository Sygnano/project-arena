"use client";

import type { RefreshProgress, SummonerView } from "@arena/types";
import { SummonerStatsView } from "@/features/recap/components/summoner-stats-view";
import { SummonerStory } from "@/features/recap/components/summoner-story";
import { NoArenaGames } from "./components/no-arena-games";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  summoner: SummonerView;
  /** A fetch in progress when the page loaded, joined on mount. */
  refresh: RefreshProgress | null;
  /** The story recap (the summoner's page) or the full stats (`/advanced`). */
  view: "story" | "advanced";
};

/**
 * A fetched summoner's page: their recap, as the story or the full stats, or
 * the "no Arena games" screen when Riot has none on record. Either view reads
 * the stats from the query cache, filled by the server-side prefetch
 * (`RecapRoute`) or by the refresh stream.
 */
function SummonerRecap({ platform, gameName, tagLine, summoner, refresh, view }: Props) {
  if (summoner.matchCount > 0) {
    const View = view === "story" ? SummonerStory : SummonerStatsView;
    return <View region={platform} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />;
  }
  return (
    <NoArenaGames platform={platform} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />
  );
}

export { SummonerRecap };
