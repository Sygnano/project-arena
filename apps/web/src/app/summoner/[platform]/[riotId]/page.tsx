import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { NewSearchLink, StatusScreen } from "@/components/status-screen";
import {
  getSummonerStatsByRiotId,
  getSummonerStatus,
  needsRefreshScreen,
  summonerStatsQueryKey,
  type SummonerStatus,
} from "@/lib/api";
import { formatUtcDateTime } from "@/lib/format";
import { isKnownPlatform, platformRegionName } from "@/lib/riot";
import { parseRiotIdSlug } from "@/lib/riot-id";
import { getQueryClient } from "@/lib/query-client";
import { RecapRefresh } from "./recap-refresh";
import { RefreshView } from "./refresh-view";
import { SummonerStatsView } from "./stats-view";

// One status read per request, shared by generateMetadata and the page.
const loadStatus = cache(getSummonerStatus);

/** The link preview's text: always says when the matches were last fetched. */
function describeRecap(status: SummonerStatus | null, platform: string): string {
  const server = platformRegionName(platform);
  if (!status?.lastRefreshedAt) {
    return `Arena season recap on ${server}. Last updated: never. Open the link to fetch their matches.`;
  }
  const games = `${status.matchCount.toLocaleString("en-US")} Arena ${status.matchCount === 1 ? "game" : "games"}`;
  return `${games} on ${server}. Last updated ${formatUtcDateTime(status.lastRefreshedAt)}.`;
}

export async function generateMetadata(
  props: PageProps<"/summoner/[platform]/[riotId]">,
): Promise<Metadata> {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) return { title: "Arena Journey" };
  // A preview without the status beats no page: the page reports the error.
  const status = await loadStatus(platform, parsed.gameName, parsed.tagLine).catch(() => null);
  const name = status
    ? `${status.gameName}#${status.tagLine}`
    : `${parsed.gameName}#${parsed.tagLine}`;
  const description = describeRecap(status, platform);
  return {
    title: `${name} · Arena Journey`,
    description,
    openGraph: { title: `${name} · Arena season recap`, description, siteName: "Arena Journey", type: "website" },
    twitter: { card: "summary_large_image", title: `${name} · Arena season recap`, description },
  };
}

/**
 * One URL per summoner for every stage: "last updated: never" with a fetch
 * button (also for a Riot ID not tracked yet), the queue screen while their
 * matches are fetched, then the recap. The queue screen hands off with `router.refresh()`, which re-runs
 * this and lands on the recap.
 */
export default async function SummonerPage(
  props: PageProps<"/summoner/[platform]/[riotId]">,
) {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) notFound();

  const status = await loadStatus(platform, parsed.gameName, parsed.tagLine);
  if (needsRefreshScreen(status)) {
    return (
      <RefreshView
        platform={platform}
        gameName={parsed.gameName}
        tagLine={parsed.tagLine}
        initialStatus={status}
      />
    );
  }

  if (status!.matchCount === 0) {
    return (
      <StatusScreen
        eyebrow="NO ARENA GAMES"
        title={
          <>
            {status!.gameName}
            <span className="ml-2 text-[.7em] text-lol-text-muted">#{status!.tagLine}</span>
          </>
        }
        actions={<NewSearchLink />}
      >
        <p className="text-lol-text-secondary">
          Riot has no Arena matches on record for this summoner on {platformRegionName(platform)}.
          Play a few and refresh.
        </p>
        <div className="mt-5 flex justify-center">
          <RecapRefresh
            platform={platform}
            gameName={parsed.gameName}
            tagLine={parsed.tagLine}
            initialStatus={status!}
          />
        </div>
      </StatusScreen>
    );
  }

  const queryClient = getQueryClient();
  const queryKey = summonerStatsQueryKey(platform, parsed.gameName, parsed.tagLine);
  // query() (not the deprecated fetchQuery/prefetchQuery pair) both runs the
  // fetch and returns its result, so it's available here to decide
  // notFound() while also populating the cache for dehydrate() below.
  const stats = await queryClient.query({
    queryKey,
    queryFn: () => getSummonerStatsByRiotId(platform, parsed.gameName, parsed.tagLine),
  });
  if (!stats) notFound();

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SummonerStatsView
        region={platform}
        gameName={parsed.gameName}
        tagLine={parsed.tagLine}
        status={status!}
      />
    </HydrationBoundary>
  );
}
