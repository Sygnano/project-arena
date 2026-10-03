"use client";

import type { SummonerPageData } from "@arena/types";
import { isRefreshActive, useSummonerRefresh } from "@/features/recap/api/use-summoner-refresh";
import { SummonerRecap } from "@/features/recap/components/summoner-recap";
import { platformRegionName } from "@/utils/riot";
import { FetchPrompt } from "./components/fetch-prompt";
import { FetchingScreen } from "./components/fetching-screen";
import { RefreshError } from "./components/refresh-error";
import { useCanonicalHistory } from "./hooks";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  /** The stored summoner and their fetch; null when the Riot ID isn't stored yet. */
  initial: SummonerPageData | null;
};

/**
 * The summoner page until their first recap: "last updated: never" and a
 * "fetch matches" button (also for a Riot ID not stored yet). Nothing is
 * asked of Riot until it's pressed. The button opens the refresh stream:
 * Riot ID lookup, queue position, match by match, and finally the recap,
 * which replaces this screen in place. A visitor arriving during someone
 * else's fetch joins its progress.
 */
function RefreshView({ platform, gameName, tagLine, initial }: Props) {
  const { state, start } = useSummonerRefresh({
    platform,
    gameName,
    tagLine,
    autoStart: isRefreshActive(initial?.refresh),
  });
  const summoner = (state.status !== "idle" ? state.summoner : null) ?? initial?.summoner ?? null;
  useCanonicalHistory(summoner);

  if (state.status === "done") {
    return (
      <SummonerRecap
        platform={platform}
        gameName={gameName}
        tagLine={tagLine}
        summoner={state.summoner}
        refresh={null}
        view="story"
      />
    );
  }

  const title = (
    <>
      {summoner?.gameName ?? gameName}
      <span className="ml-2 text-[.7em] text-lol-text-muted">#{summoner?.tagLine ?? tagLine}</span>
    </>
  );
  const server = platformRegionName(platform);

  if (state.status === "error") {
    return (
      <RefreshError
        code={state.code}
        retryAfterSeconds={state.retryAfterSeconds}
        title={title}
        server={server}
        onRetry={start}
      />
    );
  }

  if (state.status === "idle") {
    return (
      <FetchPrompt title={title} server={server} profileIconId={summoner?.profileIconId ?? null} onStart={start} />
    );
  }

  return <FetchingScreen title={title} server={server} progress={state.progress} />;
}

export { RefreshView };
