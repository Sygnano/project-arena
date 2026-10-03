"use client";

import type { RefreshProgress, SummonerView } from "@arena/types";
import { NewSearchLink, StatusScreen } from "@/components/status-screen";
import { RecapRefresh } from "@/features/recap/components/recap-refresh";
import { platformRegionName } from "@/utils/riot";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  summoner: SummonerView;
  /** A fetch in progress when the page loaded, joined on mount. */
  refresh: RefreshProgress | null;
};

/** A fetched summoner Riot has no Arena games on record for. */
function NoArenaGames({ platform, gameName, tagLine, summoner, refresh }: Props) {
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

export { NoArenaGames };
