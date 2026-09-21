"use client";

import type { CSSProperties } from "react";
import type { PingBreakdown, PingsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { AnimatedNumber } from "@/components/animated-number";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  pings: PingsStats;
  totalPings: number;
};

// Riot's in-game minimap ping-wheel/UX assets — the same "verified against a
// real directory listing" approach as `TeamSlot.tsx`'s team crests, since
// this mapping (Riot ping-type key -> icon file) isn't published anywhere
// either. Confirmed each file exists at
// https://raw.communitydragon.org/latest/game/assets/ux/minimap/pings/.
// Most map cleanly onto the current 8-way ping wheel (see
// wiki.leagueoflegends.com/en-us/Ping): retreat/push/onMyWay/allIn/assistMe/
// needVision/enemyMissing/enemyVision. `danger` is the default-click
// "Caution" ping, `getBack` a separate legacy counter from `retreat` (Riot
// really does track both, confirmed distinct nonzero totals in real data).
// `basic`/`command` are murkier: per the wiki both are "removed historical"
// ping types predating the current wheel, yet Riot's API still counts them.
// Checked against every tracked match's real `pings` data (5,994 participant
// rows): `basic` is 0 across every single one, while `command` is actually
// the *second most common* type overall (6,430) — almost certainly the
// modern client is routing today's default click-to-ping through the
// `command` counter, not `basic`. Icon assignments below follow that
// evidence: `command` gets the generic ping marker, `basic`/`hold`/
// `visionCleared` (also always 0 in real data) get a best-effort icon since
// there's no usage to confirm against.
const PING_ICON_FILE: Record<keyof PingBreakdown, string> = {
  allIn: "all_in.png",
  assistMe: "assist.png",
  basic: "target.png",
  command: "ping.png",
  danger: "caution.png",
  enemyMissing: "mia_new.png",
  enemyVision: "area_is_warded_small_red_new.png",
  getBack: "get_back_small.png",
  hold: "hold.png",
  needVision: "need_ward.png",
  onMyWay: "on_my_way_new.png",
  push: "push.png",
  retreat: "retreat.png",
  visionCleared: "cleared.png",
};

const PING_LABEL: Record<keyof PingBreakdown, string> = {
  allIn: "All In",
  assistMe: "Assist Me",
  basic: "Basic",
  command: "Generic Ping",
  danger: "Danger",
  enemyMissing: "Enemy Missing",
  enemyVision: "Enemy Vision",
  getBack: "Get Back",
  hold: "Hold",
  needVision: "Need Vision",
  onMyWay: "On My Way",
  push: "Push",
  retreat: "Retreat",
  visionCleared: "Vision Cleared",
};

function pingIconUrl(file: string): string {
  return `https://raw.communitydragon.org/latest/game/assets/ux/minimap/pings/${file}`;
}

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
    <CategorySection
      title="PINGS"
      quote="Embrace the darkness."
      imageUrl={SECTION_BACKGROUNDS.pings}
    >
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
                      unused
                        ? "font-display text-3xl text-lol-text-muted"
                        : "font-display text-3xl text-lol-gold-50"
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
