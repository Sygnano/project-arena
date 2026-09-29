"use client";

import type { AbilityStats, ChampionStats, SummonerSpellsStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Appear } from "@/components/appear";
import { DonutChart } from "@/components/donut-chart";
import { championIconUrl } from "@/utils/riot";
import { formatCompact } from "@/utils/format";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import { StoryFact } from "@/features/recap/components/story-fact";
import { StoryPortrait } from "@/features/recap/components/story-portrait";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { ABILITY_COLORS, ABILITY_KEYS } from "@/features/recap/utils/ability-colors";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { topChampion } from "@/features/recap/utils/top-champion";
import { favoriteButton, sumCasts } from "./utils";

type Props = {
  ability: AbilityStats;
  summonerSpells: SummonerSpellsStats;
  champions: Record<number, ChampionStats>;
};

/** Story slide: every button pressed. The single ability pressed most (its
 * champion in full), the Q/W/E/R split, the busiest game and the summoner
 * spells. */
function StoryAbilities({ ability, summonerSpells, champions }: Props) {
  const championName = useChampionName();
  const total = sumCasts(ability.total);
  const favorite = favoriteButton(champions);
  const busiest = topChampion(champions, (champion) => sumCasts(champion.ability.maxGame));
  const spells = summonerSpells.spells.map((spell) => ({ ...spell, casts: summonerSpells.total[spell.spellId] ?? 0 }));
  const spellCasts = spells.reduce((sum, spell) => sum + spell.casts, 0);

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.ability}
      tone={["rgba(34,197,94,.26)", "rgba(217,70,239,.3)"]}
      labelledBy="story-abilities-title"
      className="justify-center"
    >
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-[clamp(16px,4vw,64px)] gap-y-[clamp(14px,3vh,32px)] [grid-template-areas:'text_text''portrait_donut''facts_facts'] md:grid-cols-[auto_1fr_auto] md:[grid-template-areas:'portrait_text_donut''portrait_facts_facts']">
        <div className="min-w-0 [grid-area:text] md:self-end">
          <StoryKicker>ABILITIES</StoryKicker>
          <StoryTitle id="story-abilities-title">
            <AnimatedNumber value={total} className="text-lol-blue-100" durationMs={1600} /> spells cast.
          </StoryTitle>
          {favorite ? (
            <StoryText>
              Your favorite button:{" "}
              <Em>
                {championName(favorite.championName)}&apos;s {favorite.key.toUpperCase()}
              </Em>
              , pressed <Em>{favorite.casts.toLocaleString("en-US")}</Em> times. Your keyboard remembers.
            </StoryText>
          ) : null}
        </div>

        {favorite ? (
          <div className="[grid-area:portrait]">
            <StoryPortrait
              championName={favorite.championName}
              label="FAVORITE BUTTON"
              name={championName(favorite.championName)}
              stat={`${favorite.casts.toLocaleString("en-US")} casts`}
              glow="10,200,185"
              delay={0.5}
              className="h-[clamp(170px,26vh,240px)] md:h-[clamp(240px,60vh,620px)]"
              badge={
                <span
                  className="flex size-[clamp(40px,6vh,56px)] rotate-45 items-center justify-center border-2 bg-lol-navy-950 shadow-[0_0_24px_rgba(0,0,0,.6)]"
                  style={{ borderColor: ABILITY_COLORS[favorite.key] }}
                >
                  <span
                    className="-rotate-45 font-display text-[clamp(18px,2.6vh,26px)]"
                    style={{ color: ABILITY_COLORS[favorite.key] }}
                  >
                    {favorite.key.toUpperCase()}
                  </span>
                </span>
              }
            />
          </div>
        ) : null}

        <Appear from="scale" delay={0.7} className="flex flex-col items-center [grid-area:donut]">
          <div className="max-md:[zoom:.72] [@media(max-height:760px)]:[zoom:.8]">
            <DonutChart
              size={240}
              thickness={22}
              delay={0.9}
              label="Ability casts by key"
              segments={ABILITY_KEYS.map((key) => ({ key, value: ability.total[key], color: ABILITY_COLORS[key] }))}
            >
              <span className="font-display text-3xl leading-none text-lol-gold-50">{formatCompact(total)}</span>
              <span className="mt-1 text-[10px] tracking-[.3em] text-lol-text-muted">CASTS</span>
            </DonutChart>
          </div>
          <div className="mt-2 flex gap-3.5">
            {ABILITY_KEYS.map((key) => (
              <span key={key} className="flex items-center gap-1.5 text-[12px] text-lol-text-secondary tabular-nums">
                <span className="font-display" style={{ color: ABILITY_COLORS[key] }}>
                  {key.toUpperCase()}
                </span>
                {formatCompact(ability.total[key])}
              </span>
            ))}
          </div>
        </Appear>

        <div className="grid gap-2.5 [grid-area:facts] sm:grid-cols-3 md:self-start">
          <StoryFact label="ULTIMATES" delay={1.4}>
            {ability.total.r.toLocaleString("en-US")} casts
          </StoryFact>
          {busiest ? (
            <StoryFact label="BUSIEST GAME" iconUrl={championIconUrl(busiest.championName)} roundIcon delay={1.55}>
              {sumCasts(busiest.ability.maxGame).toLocaleString("en-US")} casts on {championName(busiest.championName)}
            </StoryFact>
          ) : null}
          {spellCasts > 0 ? (
            <StoryFact label="SUMMONER SPELLS" delay={1.7}>
              {spellCasts.toLocaleString("en-US")} casts
              <span className="mt-0.5 flex flex-wrap gap-x-3 text-[11px] text-lol-text-muted">
                {spells.map((spell) => (
                  <span key={spell.spellId} className="flex items-center gap-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spell.iconUrl} alt="" width={14} height={14} className="size-3.5" />
                    {spell.name} {spell.casts.toLocaleString("en-US")}
                  </span>
                ))}
              </span>
            </StoryFact>
          ) : null}
        </div>
      </div>
    </StoryFrame>
  );
}

export { StoryAbilities };
