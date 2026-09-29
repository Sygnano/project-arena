"use client";

import { ordinal } from "@/utils/format";
import { TIER_STYLE } from "@/utils/tier-bars";
import { percent } from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/utils";

/** Games finished in each place as a column per place, 1st on the left.
 * Tier colors follow the same fixed meaning as `PlacementSplitBar` (1st
 * prismatic, 2nd-3rd gold, the rest silver), and the number of columns is
 * whatever the API sent — never a hardcoded team count (CLAUDE.md §2). */
function FinishesChart({ counts }: { counts: readonly number[] }) {
  const max = Math.max(1, ...counts);
  const games = counts.reduce((sum, count) => sum + count, 0);

  return (
    <div className="flex min-h-33 flex-1 items-stretch gap-2 pt-1">
      {counts.map((count, index) => {
        const tier = TIER_STYLE[index === 0 ? "prismatic" : index <= 2 ? "gold" : "silver"];
        return (
          <div
            key={index}
            className="flex min-w-0 flex-1 flex-col items-center"
            title={`${ordinal(index + 1)} · ${count} game${count === 1 ? "" : "s"} (${percent(count, games)})`}
          >
            <div className="font-display text-[13px] text-lol-gold-50 tabular-nums">{count}</div>
            <div className="relative mt-1 w-full flex-1">
              <div
                className={`absolute inset-x-0 bottom-0 transition-[height] duration-500 ease-out ${tier.fillClass}`}
                style={{
                  height: `${(count / max) * 100}%`,
                  minHeight: count > 0 ? 2 : 0,
                }}
              />
              <div className="absolute inset-x-0 bottom-0 h-px bg-[rgba(200,170,110,.25)]" />
            </div>
            <div className="mt-1.5 text-[11px] tracking-[.14em] text-lol-text-muted">
              {ordinal(index + 1).toUpperCase()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { FinishesChart };
