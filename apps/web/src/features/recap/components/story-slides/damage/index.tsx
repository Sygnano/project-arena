"use client";

import type { ChampionStats, DamageCurveStats, DamageStats } from "@arena/types";
import { Appear } from "@/components/appear";
import { formatCompact } from "@/utils/format";
import { Em, StoryFrame, StoryKicker, StoryText, StoryTitle } from "@/features/recap/components/story-frame";
import {
  DAMAGE_TYPE_COLORS,
  DAMAGE_TYPE_KEYS,
  DAMAGE_TYPE_LABELS,
  sumDamageBreakdown,
} from "@/features/recap/utils/damage-types";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { topChampion } from "@/features/recap/utils/top-champion";
import { DamageBlock } from "./components/damage-block";
import { DamageLines } from "./components/damage-lines";
import { damageLines } from "./utils";

type Props = {
  damage: DamageStats;
  damageTaken: DamageStats;
  damageCurves: DamageCurveStats;
  champions: Record<number, ChampionStats>;
};

/** The champion of the biggest single game on `side`, with that game's damage. */
function bestGame(champions: Record<number, ChampionStats>, side: "damage" | "damageTaken") {
  const champion = topChampion(champions, (entry) => sumDamageBreakdown(entry[side].maxGame));
  return champion ? { champion, damage: sumDamageBreakdown(champion[side].maxGame) } : null;
}

/** Story slide: damage dealt and taken. For each, the biggest game's
 * champion in full with the season's split by type beside it; then how the
 * best game's damage outran the average one's, minute by minute. */
function StoryDamage({ damage, damageTaken, damageCurves, champions }: Props) {
  const dealt = sumDamageBreakdown(damage.total);
  const taken = sumDamageBreakdown(damageTaken.total);
  const curves = damageCurves.all ? damageLines(damageCurves.all) : null;

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.damage}
      tone={["rgba(255,140,52,.32)", "rgba(0,176,240,.3)"]}
      labelledBy="story-damage-title"
      className="justify-center"
    >
      <StoryKicker>DAMAGE</StoryKicker>
      <StoryTitle id="story-damage-title">
        You dealt <span className="text-[#ffc38f]">{formatCompact(dealt)}</span> damage to champions.
      </StoryTitle>
      <StoryText>
        And you soaked up <Em>{formatCompact(taken)}</Em> in return.
      </StoryText>

      <div className="mt-[clamp(14px,3vh,32px)] flex flex-wrap items-center gap-x-[clamp(16px,3.5vw,56px)] gap-y-5">
        <DamageBlock
          label="DEALT"
          breakdown={damage.total}
          total={dealt}
          best={bestGame(champions, "damage")}
          glow="255,140,52"
          delay={0.6}
        />
        <DamageBlock
          label="TAKEN"
          breakdown={damageTaken.total}
          total={taken}
          best={bestGame(champions, "damageTaken")}
          glow="0,176,240"
          delay={0.85}
        />
        {curves ? (
          <Appear
            delay={1.2}
            className="w-full max-w-130 min-w-65 flex-1 max-sm:hidden max-lg:[@media(max-height:799px)]:hidden"
          >
            <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-[10px] tracking-[.3em]">
              <span className="text-lol-gold-100">— YOUR BEST GAME</span>
              <span className="text-lol-blue-300">— YOUR AVERAGE GAME</span>
            </div>
            <DamageLines
              delay={1.5}
              lines={[
                { key: "best", label: "Best game", values: curves.best, color: "#e9d8ae" },
                { key: "average", label: "Average game", values: curves.average, color: "#0ac8b9" },
              ]}
            />
          </Appear>
        ) : null}
      </div>

      <Appear delay={1.6} className="mt-4 flex gap-5 text-[10px] tracking-[.3em] text-lol-text-muted">
        {DAMAGE_TYPE_KEYS.map((key) => (
          <span key={key} className="flex items-center gap-2">
            <span aria-hidden className="size-2.5 rotate-45" style={{ background: DAMAGE_TYPE_COLORS[key] }} />
            {DAMAGE_TYPE_LABELS[key]}
          </span>
        ))}
      </Appear>
    </StoryFrame>
  );
}

export { StoryDamage };
