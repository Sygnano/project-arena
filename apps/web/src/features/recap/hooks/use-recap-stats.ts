import type { SummonerStatsPayload, SummonerStatsResponse } from "@arena/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { summonerStatsQueryKey } from "@/features/recap/api/summoner-query";
import { useGameCatalog } from "@/features/recap/stores/game-catalog";
import { localizeCalendarHours } from "@/features/recap/utils/localize-calendar";
import { resolveStats } from "@/features/recap/utils/resolve-stats";
import { useUtcOffsetHours } from "@/hooks/use-utc-offset-hours";

/**
 * The summoner's recap, resolved against the game catalog, for both the
 * story and the full stats. `useQuery` reads it straight out of the cache
 * seeded by the page's server-side prefetch (or by the refresh stream): same
 * query key, so no extra fetch happens. Never fetched from the browser: the
 * fetcher is server-only (it holds the API's address and secret).
 *
 * Hour-of-day stats come back in the viewer's local time (`useUtcOffsetHours`):
 * UTC on the server render, local right after hydration.
 */
function useRecapStats(region: string, gameName: string, tagLine: string): SummonerStatsResponse | undefined {
  const { data: payload } = useQuery<SummonerStatsPayload | null>({
    queryKey: summonerStatsQueryKey(region, gameName, tagLine),
    enabled: false,
  });
  const catalog = useGameCatalog();
  const offsetHours = useUtcOffsetHours();
  const resolved = useMemo(() => (payload ? resolveStats(payload, catalog) : undefined), [payload, catalog]);
  return useMemo(
    () => resolved && { ...resolved, calendar: localizeCalendarHours(resolved.calendar, offsetHours) },
    [resolved, offsetHours],
  );
}

export { useRecapStats };
