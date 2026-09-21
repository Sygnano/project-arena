import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { NewSearchLink, StatusScreen } from "@/components/status-screen";
import {
  getSummonerStatsByRiotId,
  getSummonerStatus,
  needsRefreshScreen,
  summonerStatsQueryKey,
} from "@/lib/api";
import { platformRegionName } from "@/lib/riot";
import { parseRiotIdSlug } from "@/lib/riot-id";
import { getQueryClient } from "@/lib/query-client";
import { RefreshView } from "./refresh-view";
import { SummonerStatsView } from "./stats-view";

export async function generateMetadata(
  props: PageProps<"/summoner/[platform]/[riotId]">,
): Promise<Metadata> {
  const { riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  return { title: parsed ? `${parsed.gameName}#${parsed.tagLine} · Arena Stats` : "Arena Stats" };
}

/**
 * One URL per summoner for every stage: the queue screen while their
 * matches are fetched (or while an unknown Riot ID is looked up), then the
 * recap. The queue screen hands off with `router.refresh()`, which re-runs
 * this and lands on the recap.
 */
export default async function SummonerPage(
  props: PageProps<"/summoner/[platform]/[riotId]">,
) {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed) notFound();

  const status = await getSummonerStatus(platform, parsed.gameName, parsed.tagLine);
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
          Play a few and search again.
        </p>
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
      />
    </HydrationBoundary>
  );
}
