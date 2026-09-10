"use client";

import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CategorySection } from "@/components/category-section";
import { TimePlayed } from "@/modules/TimePlayed";
import { getSummonerStatsByRiotId, summonerStatsQueryKey } from "@/lib/api";
import { profileIconUrl } from "@/lib/riot";
import { KDA } from "@/modules/KDA";
import { Positions } from "@/modules/Positions";
import { TeamSlot } from "@/modules/TeamSlot";
import { BannedChampions } from "@/modules/BannedChampions";
import { Damage } from "@/modules/Damage";
import { DamageTaken } from "@/modules/DamageTaken";
import { Augments } from "@/modules/Augments";
import { PrismaticItems } from "@/modules/PrismaticItems";
import { ChampionPicks } from "@/modules/ChampionPicks";
import { Champions } from "@/modules/Champions";
import { Kills } from "@/modules/Kills";
import { Economy } from "@/modules/Economy";
import { Ability } from "@/modules/Ability";
import { Utility } from "@/modules/Utility";
import { Fun } from "@/modules/Fun";
import { Pings } from "@/modules/Pings";

type Props = {
  region: string;
  gameName: string;
  tagLine: string;
};

/**
 * Client-side counterpart to the summoner page's server-side prefetch (see
 * page.tsx). `useQuery` reads the data straight out of the hydrated cache
 * seeded by that prefetch — same query key, so no extra fetch happens on
 * first render — rather than fetching independently.
 */
const SummonerStatsView = ({ region, gameName, tagLine }: Props) => {
  const { data: stats } = useQuery({
    queryKey: summonerStatsQueryKey(region, gameName, tagLine),
    queryFn: () => getSummonerStatsByRiotId(region, gameName, tagLine),
  });

  // page.tsx already calls notFound() server-side when the prefetch resolves
  // to null, so this is unreachable in practice — just satisfies the type.
  if (!stats) return null;

  const {
    profile,
    kda,
    timePlayed,
    calendar,
    placements,
    teamSlot,
    bannedChampions,
    damage,
    damageTaken,
    augments,
    prismaticItems,
    championCatalog,
    championPicks,
    kills,
    economy,
    ability,
    utility,
    fun,
    pings,
    champions,
  } = stats;

  console.log("stats", stats);

  return (
    <div className="h-screen snap-y snap-mandatory overflow-y-scroll">
      <CategorySection title="Overview">
        <div className="w-full max-w-3xl space-y-8 px-6">
          <div className="border-frame bg-panel flex items-center gap-6 rounded-sm border p-6">
            <Avatar className="size-20! border-2 border-lol-gold-400">
              {profile.profileIconId != null ? (
                <AvatarImage
                  src={profileIconUrl(profile.profileIconId)}
                  alt={profile.riotIdGameName}
                />
              ) : null}
              <AvatarFallback className="bg-lol-navy-800 font-display text-xl! text-lol-gold-300">
                {profile.riotIdGameName.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="space-y-1">
              <h1 className="text-heading font-display text-2xl font-semibold">
                {profile.riotIdGameName}
                <span className="ml-2 text-lg text-lol-text-muted">
                  #{profile.riotIdTagline}
                </span>
              </h1>
              <p className="text-sm text-lol-text-secondary">
                {profile.summonerLevel != null
                  ? `Level ${profile.summonerLevel} • `
                  : ""}
                {profile.matchesPlayed} Arena{" "}
                {profile.matchesPlayed === 1 ? "match" : "matches"}
              </p>
            </div>
          </div>
        </div>
      </CategorySection>

      {/* Template categories — titles only for now, real cards/graphs come next. */}
      <Positions placements={placements} gamesPlayed={profile.matchesPlayed} />

      <TimePlayed
        timePlayed={timePlayed}
        gamesPlayed={profile.matchesPlayed}
        calendar={calendar}
      />
      <TeamSlot teamSlot={teamSlot} />
      <KDA {...kda} champions={champions} />
      <Kills {...kills} />
      <ChampionPicks championPicks={championPicks} />
      <Champions championCatalog={championCatalog} championPicks={championPicks} />
      <BannedChampions bannedChampions={bannedChampions} />
      <Damage damage={damage} champions={champions} />
      <DamageTaken damageTaken={damageTaken} champions={champions} />
      <Augments augments={augments} />
      <PrismaticItems prismaticItems={prismaticItems} />
      <Economy economy={economy} />
      <Ability ability={ability} champions={champions} />
      <Utility {...utility} />
      <Fun {...fun} />
      <Pings pings={pings} />
    </div>
  );
};

export { SummonerStatsView };
