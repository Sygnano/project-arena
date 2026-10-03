"use client";

import type { RefreshProgress, SummonerView } from "@arena/types";
import { RecapRefresh } from "@/features/recap/components/recap-refresh";
import { Ability } from "@/features/recap/components/slides/ability";
import { Anvils } from "@/features/recap/components/slides/anvils";
import { AugmentHallOfFame } from "@/features/recap/components/slides/augment-hall-of-fame";
import { AugmentPicks } from "@/features/recap/components/slides/augment-picks";
import { BannedChampions } from "@/features/recap/components/slides/banned-champions";
import { Boots } from "@/features/recap/components/slides/boots";
import { ChampionGallery } from "@/features/recap/components/slides/champion-gallery";
import { ChampionPicks } from "@/features/recap/components/slides/champion-picks";
import { Champions } from "@/features/recap/components/slides/champions";
import { Damage } from "@/features/recap/components/slides/damage";
import { DamageCurve } from "@/features/recap/components/slides/damage-curve";
import { DamageTaken } from "@/features/recap/components/slides/damage-taken";
import { Farewell } from "@/features/recap/components/slides/farewell";
import { GuestOfHonor } from "@/features/recap/components/slides/guest-of-honor";
import { KDA } from "@/features/recap/components/slides/kda";
import { Kills } from "@/features/recap/components/slides/kills";
import { MetaAugments } from "@/features/recap/components/slides/meta-augments";
import { Nemesis } from "@/features/recap/components/slides/nemesis";
import { Pings } from "@/features/recap/components/slides/pings";
import { Placement } from "@/features/recap/components/slides/placement";
import { PrismaticItemHallOfFame } from "@/features/recap/components/slides/prismatic-item-hall-of-fame";
import { PrismaticItemPicks } from "@/features/recap/components/slides/prismatic-item-picks";
import { SpecialItems } from "@/features/recap/components/slides/special-items";
import { SummonerSpells } from "@/features/recap/components/slides/summoner-spells";
import { TeamSlot } from "@/features/recap/components/slides/team-slot";
import { TeamSynergy } from "@/features/recap/components/slides/team-synergy";
import { Teammates } from "@/features/recap/components/slides/teammates";
import { TimePlayed } from "@/features/recap/components/slides/time-played";
import { Utility } from "@/features/recap/components/slides/utility";
import { Vault } from "@/features/recap/components/slides/vault";
import { Versus } from "@/features/recap/components/slides/versus";
import { Welcome } from "@/features/recap/components/slides/welcome";
import { useRecapStats } from "@/features/recap/hooks/use-recap-stats";
import { useRememberRecap } from "@/features/recap/hooks/use-remember-recap";
import { ChampionNamesProvider } from "@/features/recap/stores/champion-names";
import { SlideProvider } from "@/features/recap/stores/slide-position";
import { firstTrackedDate } from "@/features/recap/utils/season-period";
import { useWheelScrollsSideways } from "@/hooks/use-wheel-scrolls-sideways";
import { summonerPath } from "@/utils/riot-id";
import { ChapterRail } from "./components/chapter-rail";
import { usePageUpkeep } from "./hooks";
import type { Slide } from "./types";
import { rate } from "./utils";

type Props = {
  region: string;
  gameName: string;
  tagLine: string;
  /** The stored summoner, for the Welcome slide's refresh control. */
  summoner: SummonerView;
  /** A fetch in progress when the page loaded, joined on mount. */
  refresh: RefreshProgress | null;
};

/**
 * The full stats (`/summoner/.../advanced`): every expert slide, one screen
 * each, for the reader who wants to dig past the story recap. Reads the
 * recap from the query cache (`useRecapStats`), resolved once against the
 * game catalog, so every module below reads names and icons.
 *
 * The page is one ordered `slides` list. It is the single source of truth
 * for section order, each section's DOM id (`#augments` deep links), the
 * short label on the previous section's "next" cue, and the chapter rail.
 */
const SummonerStatsView = ({ region, gameName, tagLine, summoner, refresh }: Props) => {
  const stats = useRecapStats(region, gameName, tagLine);
  useRememberRecap(stats?.profile);

  usePageUpkeep("summoner-scroll", stats !== undefined);
  useWheelScrollsSideways("summoner-scroll", stats !== undefined);

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
    teamSynergy,
    teammates,
    nemesis,
    versus,
    bannedChampions,
    damage,
    damageTaken,
    augments,
    augmentPicks,
    guestOfHonor,
    metaAugments,
    prismaticItems,
    prismaticItemPicks,
    specialItems,
    legendaryItems,
    championCatalog,
    championPicks,
    kills,
    economy,
    boots,
    ability,
    summonerSpells,
    damageCurves,
    utility,
    fun,
    pings,
    champions,
  } = stats;

  const matchesPlayed = profile.matchesPlayed;
  const top3Baseline = rate(placements.top3Finishes, matchesPlayed);
  const outcomeBaseline = {
    top3Rate: top3Baseline,
    top1Rate: rate(placements.top1Finishes, matchesPlayed),
  };

  const slides: Slide[] = [
    {
      id: "welcome",
      label: "WELCOME",
      chapter: "OVERVIEW",
      render: () => (
        <Welcome
          profile={profile}
          firstTrackedDate={firstTrackedDate(calendar)}
          lastMatchAt={stats.lastMatchAt}
          timePlayedSeconds={timePlayed.timePlayedSeconds}
          storyHref={summonerPath(region, gameName, tagLine)}
          freshness={
            <RecapRefresh
              platform={region}
              gameName={gameName}
              tagLine={tagLine}
              summoner={summoner}
              refresh={refresh}
            />
          }
        />
      ),
    },
    {
      id: "placement",
      label: "PLACEMENT",
      chapter: "OVERVIEW",
      render: () => <Placement placements={placements} gamesPlayed={matchesPlayed} />,
    },
    {
      id: "time",
      label: "TIME",
      chapter: "OVERVIEW",
      render: () => <TimePlayed timePlayed={timePlayed} calendar={calendar} />,
    },
    {
      id: "team-slot",
      label: "TEAM SLOT",
      chapter: "OVERVIEW",
      render: () => <TeamSlot teamSlot={teamSlot} />,
    },
    {
      id: "kda",
      label: "KDA",
      chapter: "COMBAT",
      render: () => <KDA {...kda} champions={champions} />,
    },
    {
      id: "kills",
      label: "KILLS",
      chapter: "COMBAT",
      render: () => <Kills {...kills} champions={champions} />,
    },
    {
      id: "versus",
      label: "VERSUS",
      chapter: "COMBAT",
      render: () => <Versus versus={versus} />,
    },
    {
      id: "picks",
      label: "PICKS",
      chapter: "CHAMPIONS",
      render: () => <ChampionPicks championPicks={championPicks} champions={champions} />,
    },
    {
      id: "collection",
      label: "COLLECTION",
      chapter: "CHAMPIONS",
      render: () => <ChampionGallery championPicks={championPicks} champions={champions} />,
    },
    {
      id: "arena-god",
      label: "ARENA GOD",
      chapter: "CHAMPIONS",
      render: () => <Champions championCatalog={championCatalog} championPicks={championPicks} champions={champions} />,
    },
    {
      id: "bans",
      label: "BANS",
      chapter: "CHAMPIONS",
      render: () => (
        <BannedChampions
          bannedChampions={bannedChampions}
          top3Finishes={placements.top3Finishes}
          matchesPlayed={matchesPlayed}
        />
      ),
    },
    {
      id: "damage-dealt",
      label: "DMG DEALT",
      chapter: "DAMAGE",
      render: () => (
        <Damage
          damage={damage}
          champions={champions}
          skillshots={{
            total: ability.totalSkillshotsHit,
            best: ability.bestSkillshotsHit,
          }}
        />
      ),
    },
    {
      id: "damage-curve",
      label: "DMG CURVE",
      chapter: "DAMAGE",
      render: () => <DamageCurve damageCurves={damageCurves} />,
    },
    {
      id: "damage-taken",
      label: "DMG TAKEN",
      chapter: "DAMAGE",
      render: () => (
        <DamageTaken
          damageTaken={damageTaken}
          champions={champions}
          skillshotsDodged={{
            total: fun.totalSkillshotsDodged,
            best: fun.bestSkillshotsDodged,
          }}
        />
      ),
    },
    {
      id: "augments",
      label: "AUGMENTS",
      chapter: "AUGMENTS",
      render: () => <AugmentPicks augments={augments} augmentPicks={augmentPicks} />,
    },
    {
      id: "augment-god",
      label: "AUGMENT GOD",
      chapter: "AUGMENTS",
      render: () => <AugmentHallOfFame augments={augments} augmentPicks={augmentPicks} />,
    },
    {
      id: "guests-of-honor",
      label: "GUESTS OF HONOR",
      chapter: "AUGMENTS",
      render: () => <GuestOfHonor guestOfHonor={guestOfHonor} />,
    },
    {
      id: "augment-crafting",
      label: "AUGMENT CRAFTING",
      chapter: "AUGMENTS",
      render: () => <MetaAugments metaAugments={metaAugments} />,
    },
    {
      id: "prismatic-items",
      label: "PRISMATICS",
      chapter: "ITEMS",
      render: () => <PrismaticItemPicks prismaticItems={prismaticItems} prismaticItemPicks={prismaticItemPicks} />,
    },
    {
      id: "prismatic-god",
      label: "PRISMATIC GOD",
      chapter: "ITEMS",
      render: () => <PrismaticItemHallOfFame prismaticItems={prismaticItems} prismaticItemPicks={prismaticItemPicks} />,
    },
    {
      id: "anvils",
      label: "ANVILS",
      chapter: "ITEMS",
      render: () => <Anvils economy={economy} baseline={outcomeBaseline} />,
    },
    {
      id: "special-items",
      label: "SPECIAL ITEMS",
      chapter: "ITEMS",
      render: () => <SpecialItems specialItems={specialItems} baseline={outcomeBaseline} />,
    },
    {
      id: "vault",
      label: "VAULT",
      chapter: "ITEMS",
      render: () => (
        <Vault
          economy={economy}
          legendaryItems={legendaryItems}
          matchesPlayed={matchesPlayed}
          top3Finishes={placements.top3Finishes}
        />
      ),
    },
    {
      id: "boots",
      label: "BOOTS",
      chapter: "ITEMS",
      render: () => <Boots boots={boots} />,
    },
    {
      id: "ability-casts",
      label: "ABILITIES",
      chapter: "PLAYSTYLE",
      render: () => <Ability ability={ability} champions={champions} />,
    },
    {
      id: "summoner-spells",
      label: "SUMMONERS",
      chapter: "PLAYSTYLE",
      render: () => <SummonerSpells summonerSpells={summonerSpells} />,
    },
    {
      id: "utility",
      label: "UTILITY",
      chapter: "PLAYSTYLE",
      render: () => <Utility {...utility} champions={champions} />,
    },
    {
      id: "team-synergy",
      label: "SYNERGY",
      chapter: "PEOPLE",
      render: () => <TeamSynergy {...teamSynergy} baselineTop3Rate={top3Baseline} />,
    },
    {
      id: "teammates",
      label: "TEAMMATES",
      chapter: "PEOPLE",
      render: () => <Teammates {...teammates} baselineTop3Rate={top3Baseline} />,
    },
    {
      id: "nemesis",
      label: "NEMESIS",
      chapter: "PEOPLE",
      render: () => {
        const teams = Math.max(1, ...Object.keys(placements.byPlacement).map(Number));
        const expected = matchesPlayed > 0 && teams > 1 ? ((placements.avgPlacement - 1) / (teams - 1)) * 100 : 0;
        return <Nemesis {...nemesis} expectedBeatenByRate={expected} />;
      },
    },
    {
      id: "pings",
      label: "PINGS",
      chapter: "WRAP-UP",
      render: () => <Pings pings={pings} totalPings={fun.totalPings} />,
    },
    {
      id: "farewell",
      label: "FAREWELL",
      chapter: "WRAP-UP",
      render: () => (
        <Farewell totalFistBumps={fun.totalFistBumps} placements={placements} matchesPlayed={matchesPlayed} />
      ),
    },
  ];

  // With no tracked matches every stat slide would be a wall of zeros and
  // empty panels; the Welcome slide carries its own "no games yet" state.
  const visibleSlides = matchesPlayed > 0 ? slides : slides.slice(0, 1);

  return (
    <ChampionNamesProvider names={stats.championDisplayNames}>
      {/* Snap scrolling only in the `deck` layout (large, tall viewports);
        smooth scrolling only when reduced motion isn't requested. */}
      <main
        id="summoner-scroll"
        className="h-dvh overflow-y-scroll motion-safe:scroll-smooth deck:snap-y deck:snap-mandatory"
      >
        {visibleSlides.map((slide, index) => {
          const next = visibleSlides[index + 1];
          return (
            <SlideProvider
              key={slide.id}
              value={{
                id: slide.id,
                next: next ? { id: next.id, label: next.label } : null,
              }}
            >
              {slide.render()}
            </SlideProvider>
          );
        })}
      </main>
      {visibleSlides.length > 1 ? <ChapterRail slides={visibleSlides} /> : null}
    </ChampionNamesProvider>
  );
};

export { SummonerStatsView };
