"use client";

import type { RefreshProgress, SummonerView } from "@arena/types";
import { NewSearchLink, StatusScreen } from "@/components/status-screen";
import { platformRegionName } from "@/lib/riot";
import { RecapRefresh } from "./recap-refresh";
import { SummonerStatsView } from "./stats-view";

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
    return <SummonerStatsView region={platform} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />;
  }
  return (
    <StatusScreen
      eyebrow="NO ARENA GAMES"
      title={
        <>
          {summoner.gameName}
          <span className="ml-2 text-[.7em] text-lol-text-muted">#{summoner.tagLine}</span>
        </>
      }
      actions={<NewSearchLink />}
    >
      <p className="text-lol-text-secondary">
        Riot has no Arena matches on record for this summoner on {platformRegionName(platform)}. Play a few and refresh.
      </p>
      <div className="mt-5 flex justify-center">
        <RecapRefresh platform={platform} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />
      </div>
    </StatusScreen>
  );
}

export { SummonerRecap };
