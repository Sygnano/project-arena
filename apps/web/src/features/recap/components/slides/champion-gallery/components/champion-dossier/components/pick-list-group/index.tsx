"use client";

import { useState } from "react";
import { useReducedMotion, motion } from "motion/react";
import { DiamondTabs } from "@/components/diamond-tabs";
import { pooledRate } from "@/features/recap/utils/sample";
import { formatSignedPoints } from "@/components/delta-cell";
import { StatGroup } from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/components/stat-group";
import {
  FIRST_RATE_COLOR,
  TOP3_RATE_COLOR,
} from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/constants";
import type { PickEntry } from "@/features/recap/components/slides/champion-gallery/components/champion-dossier/types";
import { PICK_COLUMNS } from "./constants";
import type { PickSortKey } from "./types";
import { sortPicks } from "./utils";

type PickTab<K extends string> = {
  key: K;
  label: string;
  color: string;
  rows: readonly PickEntry[];
  /** How the row was counted, for the hover text ("built", "picked"...). */
  verb: string;
  /** Plural noun for the list's count line ("ITEMS", "AUGMENTS"). */
  noun: string;
  empty: string;
};

/**
 * A titled list of every item or augment in one category, picked with the
 * small tabs next to the title, scrolling inside its cell so the whole
 * catalog is reachable without growing the slide. GAMES / WIN / 1ST headers
 * sort it (most games first by default; clicking the active one flips it).
 *
 * Win rates are colored against the average pick of the rows on the active
 * tab (`pooledRate`), not the champion's per-game win rate: longer games
 * hold more augments and build more items, and longer games finish higher,
 * so nearly every row would "beat" the per-game rate (CLAUDE.md §6).
 */
function PickListGroup<K extends string>({
  title,
  tabs,
  round = false,
}: {
  title: string;
  tabs: readonly PickTab<K>[];
  /** Round icon frames (augments) instead of square ones (items). */
  round?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [active, setActive] = useState<K>(() => (tabs.find((tab) => tab.rows.length > 0) ?? tabs[0]).key);
  const tab = tabs.find((candidate) => candidate.key === active) ?? tabs[0];
  const baseline = pooledRate(
    tab.rows,
    (row) => row.wins,
    (row) => row.games,
  );
  const firstBaseline = pooledRate(
    tab.rows,
    (row) => row.firsts,
    (row) => row.games,
  );
  const [sort, setSort] = useState<{ key: PickSortKey; dir: "asc" | "desc" }>({
    key: "games",
    dir: "desc",
  });
  const rows = sortPicks(tab.rows, sort.key, sort.dir);

  return (
    <StatGroup
      title={title}
      className="min-h-0"
      tabs={
        <DiamondTabs
          size="sm"
          gap={16}
          label={`${title.toLowerCase()} category`}
          tabs={tabs.map(({ key, label }) => ({ key, label }))}
          active={active}
          onChange={setActive}
        />
      }
    >
      {tab.rows.length === 0 ? (
        <div className="pt-2 text-[11px] tracking-[.14em] text-lol-text-muted">{tab.empty}</div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 pt-1 pb-1.5 text-[10px] tracking-[.18em] text-lol-text-muted">
            <span className="min-w-0 flex-1 truncate">
              {tab.rows.length} {tab.noun} · AVG WIN {Math.round(baseline)}% · 1ST {Math.round(firstBaseline)}%
            </span>
            {PICK_COLUMNS.map((column) => {
              const sorted = sort.key === column.key;
              return (
                <button
                  key={column.key}
                  type="button"
                  onClick={() =>
                    setSort(
                      sorted
                        ? { key: column.key, dir: sort.dir === "desc" ? "asc" : "desc" }
                        : { key: column.key, dir: "desc" },
                    )
                  }
                  aria-label={`Sort by ${column.label.toLowerCase()}`}
                  aria-pressed={sorted}
                  className={`flex w-10 cursor-pointer items-center justify-end gap-1 tracking-[.18em] transition-colors duration-150 hover:text-lol-gold-100 ${sorted ? "text-lol-gold-50" : ""}`}
                >
                  {sorted ? (
                    <span aria-hidden className="text-[8px] text-lol-gold-300">
                      {sort.dir === "desc" ? "▼" : "▲"}
                    </span>
                  ) : null}
                  {column.label}
                </button>
              );
            })}
          </div>
          <div className="-mr-2 max-h-72 min-h-0 flex-1 overflow-y-auto pr-2 [mask-image:linear-gradient(to_bottom,black_calc(100%-20px),transparent)] [scrollbar-color:rgba(200,170,110,.35)_transparent] [scrollbar-width:thin] deck:max-h-none">
            {/* Keyed by tab and sort so switching either replays the entrance. */}
            <div key={`${tab.key}-${sort.key}-${sort.dir}`} className="flex flex-col pb-4">
              {rows.map((row, index) => {
                const rate = row.games > 0 ? (row.wins / row.games) * 100 : 0;
                const delta = rate - baseline;
                const firstRate = row.games > 0 ? (row.firsts / row.games) * 100 : 0;
                const firstDelta = firstRate - firstBaseline;
                return (
                  <motion.div
                    key={row.id}
                    className="flex items-center gap-2.5 py-0.75"
                    initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(index, 12) * 0.025 }}
                    title={`${row.name} — ${tab.verb} in ${row.games} game${row.games === 1 ? "" : "s"}, won ${row.wins} (${formatSignedPoints(delta)} vs the average pick), 1st in ${row.firsts} (${formatSignedPoints(firstDelta)})`}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      src={row.iconUrl}
                      alt=""
                      width={26}
                      height={26}
                      className={`h-6.5 w-6.5 flex-none border bg-[#040c14] object-cover ${round ? "rounded-full" : ""}`}
                      style={{ borderColor: `color-mix(in srgb, ${tab.color} 60%, transparent)` }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[12px] text-lol-text-secondary">{row.name}</span>
                    <span className="w-10 text-right text-[11px] text-lol-text-muted tabular-nums">{row.games}</span>
                    <span
                      className="font-display w-10 text-right text-[14px] tabular-nums"
                      style={{
                        color: delta >= 0 ? TOP3_RATE_COLOR : "var(--color-lol-text-secondary)",
                      }}
                    >
                      {Math.round(rate)}%
                    </span>
                    <span
                      className="font-display w-10 text-right text-[14px] tabular-nums"
                      style={{
                        color: firstDelta >= 0 ? FIRST_RATE_COLOR : "var(--color-lol-text-secondary)",
                      }}
                    >
                      {Math.round(firstRate)}%
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </StatGroup>
  );
}

export { PickListGroup };
