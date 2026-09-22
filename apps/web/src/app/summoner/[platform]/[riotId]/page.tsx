import { cache } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { SummonerView } from "@arena/types";
import { getSummonerPage, getSummonerStatsByRiotId, hasRecap, summonerStatsQueryKey } from "@/lib/api";
import { formatUtcDateTime } from "@/lib/format";
import { isKnownPlatform, platformRegionName } from "@/lib/riot";
import { parseRiotIdSlug, summonerPath } from "@/lib/riot-id";
import { getQueryClient } from "@/lib/query-client";
import { SummonerRecap } from "./recap";
import { RefreshView } from "./refresh-view";

// One read per request, shared by generateMetadata and the page.
const loadSummonerPage = cache(getSummonerPage);

/** The link preview's text: always says when the matches were last fetched. */
function describeRecap(summoner: SummonerView | null, platform: string): string {
  const server = platformRegionName(platform);
  if (!summoner?.lastRefreshedAt) {
    return `Arena season recap on ${server}. Last updated: never. Open the link to fetch their matches.`;
  }
  const games = `${summoner.matchCount.toLocaleString("en-US")} Arena ${summoner.matchCount === 1 ? "game" : "games"}`;
  return `${games} on ${server}. Last updated ${formatUtcDateTime(summoner.lastRefreshedAt)}.`;
}

export async function generateMetadata(props: PageProps<"/summoner/[platform]/[riotId]">): Promise<Metadata> {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) return { title: "Arena Journey" };
  // A preview without the summoner beats no page: the page reports the error.
  const summoner = (await loadSummonerPage(platform, parsed.gameName, parsed.tagLine).catch(() => null))?.summoner ?? null;
  const name = summoner ? `${summoner.gameName}#${summoner.tagLine}` : `${parsed.gameName}#${parsed.tagLine}`;
  const description = describeRecap(summoner, platform);
  return {
    title: `${name} · Arena Journey`,
    description,
    openGraph: { title: `${name} · Arena season recap`, description, siteName: "Arena Journey", type: "website" },
    twitter: { card: "summary_large_image", title: `${name} · Arena season recap`, description },
  };
}

/**
 * One URL per summoner, read from our database only (never Riot):
 * - not stored, or stored but never fetched: the "fetch matches" screen,
 *   whose button opens the refresh stream (the one path to Riot);
 * - fetched: the recap, with a refresh button once it's 15 minutes old.
 */
export default async function SummonerPage(props: PageProps<"/summoner/[platform]/[riotId]">) {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) notFound();

  const page = await loadSummonerPage(platform, parsed.gameName, parsed.tagLine);
  if (page) {
    // Riot's casing, for tidy shared links.
    const canonical = summonerPath(page.summoner.region, page.summoner.gameName, page.summoner.tagLine);
    if (canonical !== summonerPath(platform, parsed.gameName, parsed.tagLine)) redirect(canonical);
  }

  if (!hasRecap(page?.summoner)) {
    return <RefreshView platform={platform} gameName={parsed.gameName} tagLine={parsed.tagLine} initial={page} />;
  }

  const recap = (
    <SummonerRecap
      platform={platform}
      gameName={parsed.gameName}
      tagLine={parsed.tagLine}
      summoner={page!.summoner}
      refresh={page!.refresh}
    />
  );
  if (page!.summoner.matchCount === 0) return recap;

  const queryClient = getQueryClient();
  // query() (not the deprecated fetchQuery/prefetchQuery pair) runs the
  // fetch and returns it, filling the cache that dehydrate() ships.
  const stats = await queryClient.query({
    queryKey: summonerStatsQueryKey(platform, parsed.gameName, parsed.tagLine),
    queryFn: () => getSummonerStatsByRiotId(platform, parsed.gameName, parsed.tagLine),
  });
  if (!stats) notFound();

  return <HydrationBoundary state={dehydrate(queryClient)}>{recap}</HydrationBoundary>;
}
