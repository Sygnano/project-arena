import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getSummonerStatsByRiotId, summonerStatsQueryKey } from "@/lib/api";
import { parseRiotIdSlug } from "@/lib/riot-id";
import { getQueryClient } from "@/lib/query-client";
import { SummonerStatsView } from "./stats-view";

export default async function SummonerPage(
  props: PageProps<"/summoner/[platform]/[riotId]">,
) {
  const { platform, riotId } = await props.params;
  const parsed = parseRiotIdSlug(riotId);
  if (!parsed) notFound();

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
