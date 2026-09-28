"use client";

import type { RefreshProgress, SummonerView } from "@arena/types";
import { NoArenaGames } from "./components/no-arena-games";
import { SummonerStatsView } from "@/features/recap/components/summoner-stats-view";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  summoner: SummonerView;
  /** A fetch in progress when the page loaded, joined on mount. */
  refresh: RefreshProgress | null;
};

/**
 * A fetched summoner's page: their recap, or the "no Arena games" screen when
 * Riot has none on record. The recap reads the stats from the query cache,
 * filled by the server-side prefetch (page.tsx) or by the refresh stream.
 */
function SummonerRecap({ platform, gameName, tagLine, summoner, refresh }: Props) {
  if (summoner.matchCount > 0) {
    return (
      <SummonerStatsView
        region={platform}
        gameName={gameName}
        tagLine={tagLine}
        summoner={summoner}
        refresh={refresh}
      />
    );
  }
  return (
    <NoArenaGames platform={platform} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />
  );
}

export { SummonerRecap };
