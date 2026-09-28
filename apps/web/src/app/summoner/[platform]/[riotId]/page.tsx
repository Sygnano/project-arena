import { cache } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getSummonerPage } from "@/features/recap/api/get-summoner-page";
import { getSummonerStatsByRiotId, RecapRateLimitedError } from "@/features/recap/api/get-summoner-stats";
import { hasRecap, summonerStatsQueryKey } from "@/features/recap/api/summoner-query";
import { isKnownPlatform } from "@/utils/riot";
import { parseRiotIdSlug, summonerPath } from "@/utils/riot-id";
import { getQueryClient } from "@/lib/query-client";
import { visitorIp } from "@/lib/visitor-ip";
import { RateLimitedView } from "@/features/recap/components/rate-limited-view";
import { SummonerRecap } from "@/features/recap/components/summoner-recap";
import { RefreshView } from "@/features/recap/components/refresh-view";
import { describeRecap } from "@/features/recap/utils/describe-recap";

// One read per request, shared by generateMetadata and the page.
const loadSummonerPage = cache(getSummonerPage);

export async function generateMetadata(props: PageProps<"/summoner/[platform]/[riotId]">): Promise<Metadata> {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) return { title: "Arena Journey" };
  // A preview without the summoner beats no page: the page reports the error.
  const summoner =
    (await loadSummonerPage(platform, parsed.gameName, parsed.tagLine).catch(() => null))?.summoner ?? null;
  const name = summoner ? `${summoner.gameName}#${summoner.tagLine}` : `${parsed.gameName}#${parsed.tagLine}`;
  const description = describeRecap(summoner, platform);
  // Link previews name only stored summoners: otherwise any URL would put
  // its own text in a card under this site's name (the tab keeps the name).
  const previewTitle = summoner ? `${name} · Arena season recap` : "Arena season recap";
  return {
    title: `${name} · Arena Journey`,
    description,
    openGraph: { title: previewTitle, description, siteName: "Arena Journey", type: "website" },
    twitter: { card: "summary_large_image", title: previewTitle, description },
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
  const ip = visitorIp(await headers());
  // query() (not the deprecated fetchQuery/prefetchQuery pair) runs the
  // fetch and returns it, filling the cache that dehydrate() ships.
  let stats;
  try {
    stats = await queryClient.query({
      queryKey: summonerStatsQueryKey(platform, parsed.gameName, parsed.tagLine),
      queryFn: () => getSummonerStatsByRiotId(platform, parsed.gameName, parsed.tagLine, ip),
    });
  } catch (err) {
    if (err instanceof RecapRateLimitedError) return <RateLimitedView retryAfterSeconds={err.retryAfterSeconds} />;
    throw err;
  }
  if (!stats) notFound();

  return <HydrationBoundary state={dehydrate(queryClient)}>{recap}</HydrationBoundary>;
}
