"use client";

import type { ChampionStats, DamageBreakdown } from "@arena/types";
import { Appear } from "@/components/appear";
import { DonutChart } from "@/components/donut-chart";
import { formatCompact } from "@/utils/format";
import { StoryPortrait } from "@/features/recap/components/story-portrait";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { DAMAGE_TYPE_COLORS, DAMAGE_TYPE_KEYS } from "@/features/recap/utils/damage-types";

type Props = {
  /** "DEALT" or "TAKEN". */
  label: string;
  /** The season's damage, by type. */
  breakdown: DamageBreakdown;
  total: number;
  /** The champion of the biggest single game, and that game's damage. */
  best: { champion: ChampionStats; damage: number } | null;
  glow: string;
  delay?: number;
};

const DONUT = 136;

/**
 * One side of the damage slide: the biggest game's champion, full portrait,
 * with the season's damage split by type in a donut pinned to its top right
 * corner, clear of the champion's name at the bottom.
 */
function DamageBlock({ label, breakdown, total, best, glow, delay = 0.6 }: Props) {
  const championName = useChampionName();
  const donut = (
    <DonutChart
      segments={DAMAGE_TYPE_KEYS.map((key) => ({ key, value: breakdown[key], color: DAMAGE_TYPE_COLORS[key] }))}
      size={DONUT}
      thickness={14}
      delay={delay + 0.3}
      label={`Damage ${label.toLowerCase()} by type`}
    >
      <span className="font-display text-2xl leading-none text-lol-gold-50">{formatCompact(total)}</span>
      <span className="mt-1 text-[9px] tracking-[.3em] text-lol-text-muted">SEASON</span>
    </DonutChart>
  );

  return (
    <div className="flex flex-col max-sm:[zoom:.82]">
      <Appear delay={delay}>
        <div className="mb-2 text-[11px] tracking-[.38em] text-lol-gold-300">{label}</div>
      </Appear>
      {best ? (
        <div className="relative pr-[64px] sm:pr-[84px]">
          <StoryPortrait
            championName={best.champion.championName}
            label="BEST GAME"
            name={championName(best.champion.championName)}
            stat={formatCompact(best.damage)}
            glow={glow}
            delay={delay}
            className="h-[clamp(170px,26vh,250px)] lg:h-[clamp(220px,40vh,420px)]"
          />
          <Appear
            from="scale"
            delay={delay + 0.2}
            className="absolute top-[6%] right-0 rounded-full bg-[rgba(4,12,20,.88)] shadow-[0_0_30px_rgba(0,0,0,.6)] max-sm:[zoom:.72]"
          >
            {donut}
          </Appear>
        </div>
      ) : (
        <Appear from="scale" delay={delay + 0.2}>
          {donut}
        </Appear>
      )}
    </div>
  );
}

export { DamageBlock };
