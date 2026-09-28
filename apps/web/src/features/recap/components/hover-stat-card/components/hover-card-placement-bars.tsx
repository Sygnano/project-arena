"use client";

import { ordinal } from "@/utils/format";
import { TIER_STYLE } from "@/utils/tier-bars";

/** One small bar per finishing place (index 0 = 1st), tier-colored like the
 * stacked charts and scaled to the most common place. Its length comes from
 * the data, never a fixed team count (CLAUDE.md §2). */
function HoverCardPlacementBars({ counts }: { counts: readonly number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex flex-col gap-1">
      {counts.map((count, index) => {
        const placement = index + 1;
        const tier = placement === 1 ? TIER_STYLE.prismatic : placement <= 3 ? TIER_STYLE.gold : TIER_STYLE.silver;
        return (
          <div key={placement} className="flex items-center gap-2">
            <span className="w-7 text-lol-text-muted">{ordinal(placement)}</span>
            <div className="h-2 flex-1">
              <div className={`h-full ${tier.fillClass}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="w-5 text-right font-display text-lol-gold-50">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export { HoverCardPlacementBars };
