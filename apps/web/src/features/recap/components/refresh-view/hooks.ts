import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SummonerView } from "@arena/types";
import { summonerPath } from "@/utils/riot-id";

/**
 * Riot's casing, once known, keeps the shared URL tidy. History only: a
 * navigation would remount the screen and drop the stream.
 */
function useCanonicalHistory(summoner: SummonerView | null) {
  const pathname = usePathname();
  useEffect(() => {
    if (!summoner) return;
    const canonical = summonerPath(summoner.region, summoner.gameName, summoner.tagLine);
    if (decodeURIComponent(canonical) !== decodeURIComponent(pathname))
      window.history.replaceState(null, "", canonical);
  }, [summoner, pathname]);
}

export { useCanonicalHistory };
