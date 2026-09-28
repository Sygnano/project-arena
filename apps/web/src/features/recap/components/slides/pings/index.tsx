"use client";

import type { CSSProperties } from "react";
import type { PingsStats, PingBreakdown } from "@arena/types";
import { CategorySection } from "@/features/recap/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { AnimatedNumber } from "@/components/animated-number";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { PING_ICON_FILE, PING_LABEL } from "./constants";
import { pingIconUrl } from "./utils";

type Props = {
  pings: PingsStats;
  totalPings: number;
};

/** Icon + count tile grid, sorted most- to least-used — replaces the old
 * horizontal bar chart with something that scales better to 14 discrete
 * types and reads at a glance without an axis. Never-used types (see the
 * icon-mapping note above — 3 of the 14 are always 0 in every tracked match
 * so far) stay in the grid rather than being filtered out, just visually
 * dimmed, the same treatment `MetaAugments` gives a never-picked augment. */
const Pings = ({ pings, totalPings }: Props) => {
  // Ping types that were never used (three of Riot's 14 counters stay at 0
  // in every tracked match) are left out rather than shown as dim clutter.
  const tiles = (Object.keys(PING_LABEL) as (keyof PingBreakdown)[])
    .map((type) => ({ type, count: pings.pings[type] }))
    .filter((tile) => tile.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <CategorySection title="PINGS" quote="Embrace the darkness." imageUrl={SECTION_BACKGROUNDS.pings}>
      <HextechPanel bodyClassName="p-8">
        <div className="mb-4 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {totalPings.toLocaleString()} TOTAL · SORTED BY USAGE
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <ul
            className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-(--ping-cols)"
            style={
              {
                "--ping-cols": `repeat(${Math.min(tiles.length, 7)}, minmax(0, 1fr))`,
              } as CSSProperties
            }
          >
            {tiles.map(({ type, count }) => {
              const unused = count === 0;
              return (
                <li
                  key={type}
                  className="flex w-40 flex-col items-center gap-4 border px-5 py-7"
                  style={{
                    borderColor: "rgba(200,170,110,.16)",
                    background: "rgba(240,230,210,.02)",
                    opacity: unused ? 0.45 : 1,
                  }}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={pingIconUrl(PING_ICON_FILE[type])}
                    alt={PING_LABEL[type]}
                    title={PING_LABEL[type]}
                    width={56}
                    height={56}
                    className="h-14 w-14"
                    style={unused ? { filter: "grayscale(1)" } : undefined}
                  />
                  <AnimatedNumber
                    value={count}
                    className={
                      unused ? "font-display text-3xl text-lol-text-muted" : "font-display text-3xl text-lol-gold-50"
                    }
                  />
                  <div className="text-center text-xs tracking-[.16em] text-lol-text-muted uppercase">
                    {PING_LABEL[type]}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { Pings };
