"use client";

import { useRef } from "react";
import type { TeammateChampionStats } from "@arena/types";
import { DeltaCell } from "@/components/delta-cell";
import { sortByRate, isLowSample } from "@/features/recap/utils/sample";
import { championIconUrl } from "@/utils/riot";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import type { PickSort } from "@/features/recap/components/slides/team-synergy/types";
import { PICK_GRID } from "./constants";
import { top3RateOf } from "./utils";

/**
 * Champions your teammates played, with how you finished in those games.
 * The chord chart shows who shares a team; this list shows which of those
 * teammates' picks go with better or worse results for you.
 */
function TeammatePicks({
  rows,
  baselineTop3Rate,
  sort,
  mixLowSample,
}: {
  rows: TeammateChampionStats[];
  baselineTop3Rate: number;
  sort: PickSort;
  /** BEST WINRATE: rank pairs under MIN_SAMPLE games with the rest (still dimmed). */
  mixLowSample: boolean;
}) {
  const displayName = useChampionName();
  const listRef = useRef<HTMLUListElement>(null);
  useDragScroll(listRef, "y");
  const sorted =
    sort === "games"
      ? rows
      : sortByRate(rows, top3RateOf, (row) => row.games, "desc", mixLowSample ? "mixed" : "after");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid items-center gap-3 border-b border-[rgba(200,170,110,.2)] pb-2 text-[11px] tracking-[.2em] text-[#a09b8c]"
        style={{ gridTemplateColumns: PICK_GRID }}
      >
        <div />
        <div>TEAMMATE CHAMPION</div>
        <div className="text-right">GAMES</div>
        <div className="text-right">WINRATE</div>
        <div className="text-right" title="Your winrate in these games minus your overall winrate">
          VS AVG
        </div>
      </div>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {sorted.map((row) => {
          const rate = top3RateOf(row);
          // MOST GAMES ranks by the count itself, so no row is flagged as low-sample.
          const low = sort !== "games" && isLowSample(row.games);
          return (
            <li
              key={row.championId}
              className="grid items-center gap-3 border-b border-[rgba(200,170,110,.08)] py-1.5"
              style={{
                gridTemplateColumns: PICK_GRID,
                opacity: low ? 0.45 : 1,
              }}
              aria-label={`${displayName(row.championName)} on your team: ${row.games} games, your winrate ${rate.toFixed(0)}%`}
            >
              <img
                loading="lazy"
                decoding="async"
                src={championIconUrl(row.championName)}
                alt=""
                width={28}
                height={28}
                className="border border-[rgba(200,170,110,.45)]"
              />
              <div className="truncate text-sm text-lol-text-secondary">{displayName(row.championName)}</div>
              <div className="font-display text-right text-[15px] text-lol-gold-50 tabular-nums">{row.games}</div>
              <div className="font-display text-right text-[15px] text-lol-gold-50 tabular-nums">
                {rate.toFixed(0)}%
              </div>
              {low ? (
                <div className="text-right text-[11px] text-lol-text-muted">—</div>
              ) : (
                <DeltaCell delta={rate - baselineTop3Rate} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { TeammatePicks };
