import { useEffect } from "react";
import type { SummonerProfile } from "@arena/types";
import { rememberRecap } from "@/lib/recent-recaps";

/** Adds a recap with games to this browser's own "recently viewed" list
 * (splash page), from either view of it. */
function useRememberRecap(profile: SummonerProfile | undefined) {
  useEffect(() => {
    if (!profile || profile.matchesPlayed === 0) return;
    rememberRecap({
      region: profile.region,
      gameName: profile.riotIdGameName,
      tagLine: profile.riotIdTagline,
      profileIconId: profile.profileIconId,
    });
  }, [profile]);
}

export { useRememberRecap };
