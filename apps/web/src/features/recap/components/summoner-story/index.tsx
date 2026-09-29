"use client";

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import type { RefreshProgress, SummonerView } from "@arena/types";
import { summonerAdvancedPath } from "@/utils/riot-id";
import { RecapRefresh } from "@/features/recap/components/recap-refresh";
import { StoryAbilities } from "@/features/recap/components/story-slides/abilities";
import { StoryAugments } from "@/features/recap/components/story-slides/augments";
import { StoryChampions } from "@/features/recap/components/story-slides/champions";
import { StoryCombat } from "@/features/recap/components/story-slides/combat";
import { StoryDamage } from "@/features/recap/components/story-slides/damage";
import { StoryFarewell } from "@/features/recap/components/story-slides/farewell";
import { StoryFinishes } from "@/features/recap/components/story-slides/finishes";
import { StoryItems } from "@/features/recap/components/story-slides/items";
import { StorySeason } from "@/features/recap/components/story-slides/season";
import { StoryTeammates } from "@/features/recap/components/story-slides/teammates";
import { useRecapStats } from "@/features/recap/hooks/use-recap-stats";
import { useRememberRecap } from "@/features/recap/hooks/use-remember-recap";
import { ChampionNamesProvider } from "@/features/recap/stores/champion-names";
import { firstTrackedDate, seasonPeriod } from "@/features/recap/utils/season-period";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { StoryCover } from "./components/story-cover";
import { StoryPlayer, type StorySlide } from "./components/story-player";
import { useFullStatsHash } from "./hooks";

type Props = {
  region: string;
  gameName: string;
  tagLine: string;
  /** The stored summoner, for the cover's refresh control. */
  summoner: SummonerView;
  /** A fetch in progress when the page loaded, joined on mount. */
  refresh: RefreshProgress | null;
};

/**
 * The summoner page (`/summoner/<platform>/<riotId>`): a cover, then the
 * story recap, a Spotify Wrapped style run of full-screen slides that play
 * on their own, a few seconds each, text first with one or two visuals.
 * It tells the season at a glance; the full stats (`.../advanced`) hold
 * everything else, one link away on the cover and at the end.
 *
 * `slides` is the story's one ordered list: order, timing and entrance of
 * every slide. Slides without the data to say anything are left out.
 */
function SummonerStory({ region, gameName, tagLine, summoner, refresh }: Props) {
  const stats = useRecapStats(region, gameName, tagLine);
  useRememberRecap(stats?.profile);
  const [playing, setPlaying] = useState(false);
  const advancedHref = summonerAdvancedPath(region, gameName, tagLine);
  useFullStatsHash(advancedHref);

  // page.tsx calls notFound() when the server-side prefetch finds nothing.
  if (!stats) return null;

  const { profile, placements, timePlayed, calendar, championPicks, augments, economy } = stats;
  const matchesPlayed = profile.matchesPlayed;
  const firstDay = firstTrackedDate(calendar);
  const period = firstDay && stats.lastMatchAt ? seasonPeriod(firstDay, stats.lastMatchAt) : null;

  const slides = (
    [
      {
        id: "season",
        label: "The grind",
        durationMs: 11_000,
        transition: "rise",
        background: SECTION_BACKGROUNDS.timePlayed,
        render: () => <StorySeason matchesPlayed={matchesPlayed} timePlayed={timePlayed} calendar={calendar} />,
      },
      {
        id: "finishes",
        label: "How you finished",
        durationMs: 12_000,
        transition: "slide",
        background: SECTION_BACKGROUNDS.positions,
        render: () => (
          <StoryFinishes
            matchesPlayed={matchesPlayed}
            placements={placements}
            timePlayed={timePlayed}
            teamSlot={stats.teamSlot}
          />
        ),
      },
      championPicks.champions.length > 0 && {
        id: "champions",
        label: "Your champions",
        durationMs: 11_000,
        transition: "iris",
        background: SECTION_BACKGROUNDS.championPicks,
        render: () => <StoryChampions championPicks={championPicks} matchesPlayed={matchesPlayed} />,
      },
      {
        id: "combat",
        label: "Combat",
        durationMs: 11_000,
        transition: "tilt",
        background: SECTION_BACKGROUNDS.kills,
        render: () => <StoryCombat kda={stats.kda} champions={stats.champions} />,
      },
      {
        id: "damage",
        label: "Damage",
        durationMs: 12_000,
        transition: "wipe",
        background: SECTION_BACKGROUNDS.damage,
        render: () => (
          <StoryDamage
            damage={stats.damage}
            damageTaken={stats.damageTaken}
            damageCurves={stats.damageCurves}
            champions={stats.champions}
          />
        ),
      },
      augments.augments.some((augment) => augment.timesPicked > 0) && {
        id: "augments",
        label: "Augments",
        durationMs: 12_000,
        transition: "zoom",
        background: SECTION_BACKGROUNDS.augmentPicks,
        render: () => <StoryAugments augments={augments} augmentPicks={stats.augmentPicks} />,
      },
      economy.itemsPurchased > 0 && {
        id: "items",
        label: "Items",
        durationMs: 11_000,
        transition: "slide",
        background: SECTION_BACKGROUNDS.prismaticItemPicks,
        render: () => (
          <StoryItems
            economy={economy}
            prismaticItems={stats.prismaticItems}
            prismaticItemPicks={stats.prismaticItemPicks}
            specialItems={stats.specialItems}
          />
        ),
      },
      {
        id: "abilities",
        label: "Abilities",
        durationMs: 11_000,
        transition: "iris",
        background: SECTION_BACKGROUNDS.ability,
        render: () => (
          <StoryAbilities ability={stats.ability} summonerSpells={stats.summonerSpells} champions={stats.champions} />
        ),
      },
      {
        id: "teammates",
        label: "Your squad",
        durationMs: 10_000,
        transition: "rise",
        background: SECTION_BACKGROUNDS.teammates,
        render: () => <StoryTeammates teammates={stats.teammates} />,
      },
      {
        id: "farewell",
        label: "GG, well played",
        durationMs: 12_000,
        transition: "zoom",
        background: SECTION_BACKGROUNDS.farewell,
        render: (controls) => (
          <StoryFarewell
            totalFistBumps={stats.fun.totalFistBumps}
            placements={placements}
            matchesPlayed={matchesPlayed}
            advancedHref={advancedHref}
            onReplay={controls.restart}
          />
        ),
      },
    ] satisfies (StorySlide | false)[]
  ).filter((slide) => slide !== false);

  return (
    <ChampionNamesProvider names={stats.championDisplayNames}>
      <StoryCover
        profile={profile}
        period={period}
        freshness={
          <RecapRefresh platform={region} gameName={gameName} tagLine={tagLine} summoner={summoner} refresh={refresh} />
        }
        advancedHref={advancedHref}
        active={!playing}
        hasGames={matchesPlayed > 0}
        onStart={() => setPlaying(true)}
      />
      <AnimatePresence>
        {playing ? <StoryPlayer slides={slides} profile={profile} onClose={() => setPlaying(false)} /> : null}
      </AnimatePresence>
    </ChampionNamesProvider>
  );
}

export { SummonerStory };
