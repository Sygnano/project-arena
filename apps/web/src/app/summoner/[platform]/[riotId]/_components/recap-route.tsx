import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getSummonerStatsByRiotId, RecapRateLimitedError } from "@/features/recap/api/get-summoner-stats";
import { hasRecap, summonerStatsQueryKey } from "@/features/recap/api/summoner-query";
import { RateLimitedView } from "@/features/recap/components/rate-limited-view";
import { RefreshView } from "@/features/recap/components/refresh-view";
import { SummonerRecap } from "@/features/recap/components/summoner-recap";
import { getQueryClient } from "@/lib/query-client";
import { visitorIp } from "@/lib/visitor-ip";
import { isKnownPlatform } from "@/utils/riot";
import { parseRiotIdSlug, summonerAdvancedPath, summonerPath } from "@/utils/riot-id";
import { loadSummonerPage } from "@/app/summoner/[platform]/[riotId]/_lib/load-summoner-page";

type Props = {
  params: { platform: string; riotId: string };
  /** The story recap (`/summoner/<platform>/<riotId>`) or the full stats (`.../advanced`). */
  view: "story" | "advanced";
};

/**
 * Both views of a summoner, read from our database only (never Riot):
 * - not stored, or stored but never fetched: the "fetch matches" screen,
 *   whose button opens the refresh stream (the one path to Riot). It lives
 *   on the summoner's own page: the full stats send visitors there;
 * - fetched: the recap, the story or the full stats, both prefetched here
 *   into the query cache the browser hydrates from.
 */
export async function RecapRoute({ params: { platform, riotId }, view }: Props) {
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed || !isKnownPlatform(platform)) notFound();
  const path = view === "story" ? summonerPath : summonerAdvancedPath;

  const page = await loadSummonerPage(platform, parsed.gameName, parsed.tagLine);
  if (page) {
    // Riot's casing, for tidy shared links.
    const canonical = path(page.summoner.region, page.summoner.gameName, page.summoner.tagLine);
    if (canonical !== path(platform, parsed.gameName, parsed.tagLine)) redirect(canonical);
  }

  if (!hasRecap(page?.summoner)) {
    if (view === "advanced") redirect(summonerPath(platform, parsed.gameName, parsed.tagLine));
    return <RefreshView platform={platform} gameName={parsed.gameName} tagLine={parsed.tagLine} initial={page} />;
  }

  const recap = (
    <SummonerRecap
      platform={platform}
      gameName={parsed.gameName}
      tagLine={parsed.tagLine}
      summoner={page!.summoner}
      refresh={page!.refresh}
      view={view}
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
