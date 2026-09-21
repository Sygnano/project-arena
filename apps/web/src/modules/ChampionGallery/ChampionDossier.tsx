"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import type {
  AbilityCastBreakdown,
  ChampionAugmentStats,
  ChampionFormStats,
  ChampionItemStats,
  ChampionPickBreakdown,
  ChampionStats,
  DamageBreakdown,
} from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { ChampionCard } from "./ChampionCard";
import { CompositionDonut, type DonutSlice } from "./CompositionDonut";
import {
  DAMAGE_TYPE_COLORS,
  DAMAGE_TYPE_KEYS,
  DAMAGE_TYPE_LABELS,
  sumDamageBreakdown,
} from "@/lib/damage-types";
import { ABILITY_COLORS, ABILITY_KEYS } from "@/lib/ability-colors";
import { formatCompact, formatDuration, formatHoursMinutes, ordinal } from "@/lib/format";
import { TIER_STYLE } from "@/lib/tier-bars";
import { pooledRate } from "@/lib/sample";
import { formatSignedPoints } from "@/components/delta-cell";

type Mode = "total" | "best";

/** Same two rate colors Champion Picks uses for the identical two figures,
 * so "gold = top 3, prismatic = 1st" stays consistent between the section
 * that ranks champions and the one that drills into them. */
const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

const HEAL_COLOR = "var(--color-lol-heal)";
const CC_COLOR = "#ba00fb";
const SPECIAL_COLOR = "var(--color-lol-blue-300)";

/** Literal swatches for the anvil donut — the same three tier colors
 * `tier-bars.ts`'s flat swatches use (nivo needs real colors, not CSS
 * variables). */
const ANVIL_COLORS = {
  stat: "#b9c4c8",
  legendary: "#c89b3c",
  prismatic: "#b98add",
} as const;

const NO_DAMAGE: DamageBreakdown = { physical: 0, magical: 0, trueDamage: 0 };
const NO_CASTS: AbilityCastBreakdown = { q: 0, w: 0, e: 0, r: 0 };

function percent(part: number, whole: number): string {
  if (whole <= 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}


/** One titled block of the dossier's stat grid — a small caps heading over a
 * hairline rule, then its content. */
function StatGroup({
  title,
  tabs,
  aside,
  children,
  className,
}: {
  title: string;
  /** Tabs sitting right after the title (e.g. a list's categories). */
  tabs?: ReactNode;
  /** Right-aligned note on the heading line (e.g. an average). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex min-w-0 flex-col ${className ?? ""}`}>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <h3 className="text-[11px] tracking-[.26em] whitespace-nowrap text-lol-gold-300">
          {title}
        </h3>
        {tabs}
        {aside ? (
          <div className="ml-auto text-[11px] tracking-[.2em] text-lol-text-muted sm:whitespace-nowrap">
            {aside}
          </div>
        ) : null}
      </div>
      <div
        className="mt-1 mb-1 h-px w-full"
        style={{
          background:
            "linear-gradient(90deg, rgba(200,170,110,.32), transparent)",
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/** One `LABEL .......... value` line inside a `StatGroup`. The value is a
 * node rather than a string so callers can hand it an `AnimatedNumber` (the
 * common case) or a composite like a K/D/A triple. */
function StatLine({
  label,
  value,
  valueColor,
  note,
}: {
  label: string;
  value: ReactNode;
  valueColor?: string;
  /** Small muted text just before the value (e.g. the K/D/A behind a KDA). */
  note?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="flex-1 truncate text-[11px] tracking-[.14em] text-lol-text-muted">
        {label}
      </span>
      {note ? (
        <span className="text-[11px] text-lol-text-muted tabular-nums">
          {note}
        </span>
      ) : null}
      <span
        className="font-display text-[16px] leading-[1.45] tabular-nums"
        style={{ color: valueColor ?? "var(--color-lol-gold-50)" }}
      >
        {value}
      </span>
    </div>
  );
}

/** Reads a stat as a plain animated integer — the default for almost every
 * line below, so it's worth not repeating the `<AnimatedNumber>` call. */
function Num({
  value,
  compact = false,
  suffix,
}: {
  value: number;
  compact?: boolean;
  suffix?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      durationMs={700}
      format={(v) => {
        const rounded = Math.round(v);
        const text = compact
          ? formatCompact(rounded)
          : rounded.toLocaleString("en-US");
        return suffix ? `${text}${suffix}` : text;
      }}
    />
  );
}

/** The three-way placement split as one bar — the same prismatic / gold /
 * silver tier fills (and therefore the same meaning) as Champion Picks'
 * stacked columns, just laid out horizontally to fit the identity column. */
function PlacementSplitBar({ champion }: { champion: ChampionPickBreakdown }) {
  const segments = [
    { key: "top1", value: champion.top1, tier: TIER_STYLE.prismatic },
    { key: "top3", value: champion.top3ExclTop1, tier: TIER_STYLE.gold },
    { key: "rest", value: champion.remaining, tier: TIER_STYLE.silver },
  ] as const;

  return (
    <div className="flex h-2.5 w-full overflow-hidden bg-[rgba(200,170,110,.1)]">
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={segment.tier.fillClass}
          title={`${segment.value} game${segment.value === 1 ? "" : "s"}`}
          style={{
            width:
              champion.timesPicked > 0
                ? `${(segment.value / champion.timesPicked) * 100}%`
                : "0%",
          }}
        />
      ))}
    </div>
  );
}

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
        const tier =
          TIER_STYLE[index === 0 ? "prismatic" : index <= 2 ? "gold" : "silver"];
        return (
          <div
            key={index}
            className="flex min-w-0 flex-1 flex-col items-center"
            title={`${ordinal(index + 1)} · ${count} game${count === 1 ? "" : "s"} (${percent(count, games)})`}
          >
            <div className="font-display text-[13px] text-lol-gold-50 tabular-nums">
              {count}
            </div>
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

/** Horizontal room per game on the form chart. Past what fits in the cell,
 * the chart scrolls sideways (opening on the newest games). */
const FORM_STEP_PX = 22;
/** Room kept around the plot so edge diamonds and their glow aren't cut —
 * wider on the sides, where the newest game's outlined diamond sits right
 * against the scroller's edge. */
const FORM_PAD_PX = 8;
const FORM_PAD_X_PX = 16;

function streakCaption(form: ChampionFormStats): { text: string; color: string } {
  if (form.currentWinStreak >= 2) {
    return { text: `${form.currentWinStreak} WINS IN A ROW`, color: TOP3_RATE_COLOR };
  }
  if (form.currentWinStreak === 1) {
    return { text: "WON LAST GAME", color: TOP3_RATE_COLOR };
  }
  const lastWin = form.games.findIndex((game) => game.placement <= 3);
  if (lastWin === -1) {
    return {
      text: `NO WIN IN ${form.games.length} GAME${form.games.length === 1 ? "" : "S"}`,
      color: "var(--color-lol-text-muted)",
    };
  }
  return {
    text: `LAST WIN ${lastWin} GAME${lastWin === 1 ? "" : "S"} AGO`,
    color: "var(--color-lol-text-secondary)",
  };
}

/** Every game on this champion as a placement line, oldest on the left:
 * 1st at the top, the worst place any tracked match reached at the bottom,
 * a dashed rule marking where a win (top 3) ends. Each game gets a fixed
 * step, so a long history scrolls sideways; it opens scrolled to the newest
 * games. The line draws itself in and each game's tier diamond pops in
 * after it. The plot fills whatever height its cell has — it sits in an
 * absolutely positioned scroller so its own height never feeds back into
 * the row's. */
function FormChart({
  form,
  maxPlacement,
}: {
  form: ChampionFormStats;
  maxPlacement: number;
}) {
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const measure = () =>
      setSize({ width: scroller.clientWidth, height: scroller.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, []);

  const games = [...form.games].reverse();
  const width = Math.max(size.width, FORM_PAD_X_PX * 2 + (games.length - 1) * FORM_STEP_PX);
  const height = size.height;
  const worst = Math.max(2, maxPlacement);

  // Open on the newest games once the plot has a real width.
  const opened = useRef(false);
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || size.width === 0 || opened.current) return;
    opened.current = true;
    scroller.scrollLeft = scroller.scrollWidth;
  }, [size.width, width]);

  const x = (index: number) =>
    games.length === 1
      ? width / 2
      : FORM_PAD_X_PX + (index / (games.length - 1)) * (width - FORM_PAD_X_PX * 2);
  const y = (placement: number) =>
    FORM_PAD_PX + ((placement - 1) / (worst - 1)) * Math.max(0, height - FORM_PAD_PX * 2);
  const points = games.map((game, index) => `${x(index)},${y(game.placement)}`).join(" ");
  const caption = streakCaption(form);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="relative mt-1 min-h-12 flex-1">
        <div
          ref={scrollerRef}
          className="absolute inset-0 overflow-x-auto overflow-y-hidden [scrollbar-color:rgba(200,170,110,.35)_transparent] [scrollbar-width:thin]"
        >
          {size.width > 0 && height > 0 && games.length > 0 ? (
            <div className="relative" style={{ width, height }}>
              {worst > 3 ? (
                <div
                  className="absolute inset-x-0 border-t border-dashed border-[rgba(200,170,110,.22)]"
                  style={{ top: (y(3) + y(4)) / 2 }}
                />
              ) : null}
              <svg
                className="absolute inset-0 overflow-visible"
                width={width}
                height={height}
                aria-hidden
              >
                <motion.polyline
                  points={points}
                  fill="none"
                  stroke="rgba(200,170,110,.5)"
                  strokeWidth={1.25}
                  strokeLinejoin="round"
                  initial={reduceMotion ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                />
              </svg>
              {games.map((game, index) => {
                const tier =
                  TIER_STYLE[
                    game.placement === 1 ? "prismatic" : game.placement <= 3 ? "gold" : "silver"
                  ];
                const newest = index === games.length - 1;
                return (
                  <motion.div
                    key={`${game.playedAt}-${index}`}
                    className="absolute h-2.5 w-2.5"
                    style={{ left: x(index) - 5, top: y(game.placement) - 5 }}
                    initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{
                      delay: 0.9 * (index / Math.max(1, games.length - 1)),
                      type: "spring",
                      stiffness: 420,
                      damping: 18,
                    }}
                    title={`${ordinal(game.placement)} · ${game.kills}/${game.deaths}/${game.assists} · ${new Date(game.playedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                  >
                    <div
                      className={`h-full w-full rotate-45 ${tier.fillClass}`}
                      style={newest ? { boxShadow: tier.glow, outline: `1px solid ${tier.edge}`, outlineOffset: 2 } : undefined}
                    />
                  </motion.div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {/* Wraps onto two lines in a narrow column rather than truncating. */}
      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 text-[11px] tracking-[.14em]">
        <span style={{ color: caption.color }}>{caption.text}</span>
        {form.longestWinStreak > 1 ? (
          <span className="text-lol-text-muted">
            BEST STREAK {form.longestWinStreak}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One row of a `PickListGroup`: an item or augment with how many games on
 * this champion it was counted in and how many of those were won. */
type PickEntry = {
  id: number;
  name: string;
  iconUrl: string;
  games: number;
  wins: number;
  firsts: number;
};

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

type PickSortKey = "games" | "win" | "first";

const PICK_COLUMNS: readonly { key: PickSortKey; label: string }[] = [
  { key: "games", label: "GAMES" },
  { key: "win", label: "WIN" },
  { key: "first", label: "1ST" },
];

/** Orders a list by the chosen column; ties break toward more games.
 * Deliberately no small-sample handling here (no dimming, no pushing
 * low-game rows last): one champion's own games are often few, so on a
 * rarely played champion that rule would dim or demote nearly every row. */
function sortPicks(
  rows: readonly PickEntry[],
  key: PickSortKey,
  dir: "asc" | "desc",
): PickEntry[] {
  const value =
    key === "games"
      ? (row: PickEntry) => row.games
      : key === "win"
        ? (row: PickEntry) => row.wins / Math.max(1, row.games)
        : (row: PickEntry) => row.firsts / Math.max(1, row.games);
  const sign = dir === "desc" ? 1 : -1;
  return [...rows].sort((a, b) => sign * (value(b) - value(a)) || b.games - a.games);
}

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
  const [active, setActive] = useState<K>(
    () => (tabs.find((tab) => tab.rows.length > 0) ?? tabs[0]).key,
  );
  const tab = tabs.find((candidate) => candidate.key === active) ?? tabs[0];
  const baseline = pooledRate(tab.rows, (row) => row.wins, (row) => row.games);
  const firstBaseline = pooledRate(tab.rows, (row) => row.firsts, (row) => row.games);
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
        <div className="pt-2 text-[11px] tracking-[.14em] text-lol-text-muted">
          {tab.empty}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5 pt-1 pb-1.5 text-[10px] tracking-[.18em] text-lol-text-muted">
            <span className="min-w-0 flex-1 truncate">
              {tab.rows.length} {tab.noun} · AVG WIN {Math.round(baseline)}% · 1ST{" "}
              {Math.round(firstBaseline)}%
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
                    <span className="min-w-0 flex-1 truncate text-[12px] text-lol-text-secondary">
                      {row.name}
                    </span>
                    <span className="w-10 text-right text-[11px] text-lol-text-muted tabular-nums">
                      {row.games}
                    </span>
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
                        color:
                          firstDelta >= 0 ? FIRST_RATE_COLOR : "var(--color-lol-text-secondary)",
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

function itemEntries(items: readonly ChampionItemStats[] | undefined): PickEntry[] {
  return (items ?? []).map((item) => ({
    id: item.itemId,
    name: item.itemName,
    iconUrl: item.iconUrl,
    games: item.count,
    wins: item.top3,
    firsts: item.top1,
  }));
}

function augmentEntries(
  augments: readonly ChampionAugmentStats[] | undefined,
  rarity: number,
): PickEntry[] {
  return (augments ?? [])
    .filter((augment) => augment.rarity === rarity)
    .map((augment) => ({
      id: augment.augmentId,
      name: augment.augmentName,
      iconUrl: augment.iconUrl,
      games: augment.timesPicked,
      wins: augment.top3,
      firsts: augment.top1,
    }));
}

function damageSlices(breakdown: DamageBreakdown): DonutSlice[] {
  return DAMAGE_TYPE_KEYS.map((key) => ({
    key,
    label: DAMAGE_TYPE_LABELS[key],
    value: breakdown[key],
    color: DAMAGE_TYPE_COLORS[key],
  }));
}

function castSlices(breakdown: AbilityCastBreakdown): DonutSlice[] {
  return ABILITY_KEYS.map((key) => ({
    key,
    label: key.toUpperCase(),
    value: breakdown[key],
    color: ABILITY_COLORS[key],
  }));
}

function sumCasts(breakdown: AbilityCastBreakdown): number {
  return breakdown.q + breakdown.w + breakdown.e + breakdown.r;
}

/**
 * The per-champion drilldown that replaces the gallery when a card is
 * opened — a miniature of the summoner page's own stat sections, scoped to
 * one champion and sized to fit inside a single `HextechPanel`.
 *
 * A TOTAL / BEST GAME switch (the same tabs Damage and Ability use) flips
 * the stat groups and donuts between career sums and single-match records.
 * Text lines in BEST GAME are each independently maxed (the most kills and
 * the most deaths can come from different matches), while each donut shows
 * one real match's split (its `maxGame`), since a composition stitched
 * together from several matches wouldn't describe any game. Finishes and
 * items and recent form don't have a single-match reading and stay the same
 * in both modes.
 *
 * Deliberately covers only what happens in a fight on this champion. Page-
 * level sections that aren't champion-scoped — bans (lobby-wide, with no
 * participant attached, see CLAUDE.md §2), teammates and nemesis (accounts,
 * not champions) and pings — have no meaningful per-champion reading and
 * are left out rather than shown as noise.
 */
export function ChampionDossier({
  pick,
  stats,
  rank,
  totalChampions,
}: {
  pick: ChampionPickBreakdown;
  /** Undefined only in the (unreachable in practice) case where a champion
   * has picks but no aggregate row — both come from the same
   * `match_participants` rows. Guarded anyway so a data gap degrades to an
   * empty dossier instead of a crash. */
  stats: ChampionStats | undefined;
  rank: number;
  totalChampions: number;
}) {
  const [mode, setMode] = useState<Mode>("total");
  const best = mode === "best";

  const won = pick.top1 + pick.top3ExclTop1;
  const games = stats?.matchesPlayed ?? pick.timesPicked;
  const kda = stats?.kda;
  const combat = stats?.combat;
  const economy = stats?.economy;
  const utility = best ? stats?.utility.bestByType : stats?.utility.total;

  const careerKda = kda
    ? (kda.totalKills + kda.totalAssists) / Math.max(1, kda.totalDeaths)
    : 0;
  const bestGame = kda?.bestGame;
  const bestKda = bestGame
    ? (bestGame.kills + bestGame.assists) / Math.max(1, bestGame.deaths)
    : 0;

  const damageDealt = (best ? stats?.damage.maxGame : stats?.damage.total) ?? NO_DAMAGE;
  const damageTaken =
    (best ? stats?.damageTaken.maxGame : stats?.damageTaken.total) ?? NO_DAMAGE;
  const casts = (best ? stats?.ability.maxGame : stats?.ability.total) ?? NO_CASTS;
  const anvils = best
    ? (economy?.maxGameAnvils ?? { stat: 0, legendary: 0, prismatic: 0 })
    : {
        stat: economy?.statAnvilsBought ?? 0,
        legendary: economy?.legendaryAnvilsBought ?? 0,
        prismatic: economy?.prismaticAnvilsBought ?? 0,
      };

  /** Hole caption for a donut: a per-game average on TOTAL, a plain
   * "ONE GAME" tag on BEST GAME. */
  const perGame = (total: number, format: (value: number) => string) =>
    best ? "ONE GAME" : `${format(games > 0 ? total / games : 0)} / GAME`;
  const compact = (value: number) => formatCompact(Math.round(value));
  const plain = (value: number) => Math.round(value).toLocaleString("en-US");

  const items = stats?.items;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[236px_minmax(0,1fr)]">
      {/* Identity column — the same card the gallery shows, so opening a
        card reads as that card staying put while the stats arrive beside
        it, rather than switching to an unrelated layout. In deck mode the
        card takes only the height the rows below it leave (a size container
        measuring that slot), so a short viewport shrinks the card instead of
        pushing the rows past the panel. */}
      <div className="mx-auto flex w-full max-w-[236px] flex-col md:max-w-none deck:min-h-0">
        <div className="w-full flex-none deck:min-h-0 deck:flex-1 deck:@container-size">
          <div className="deck:mx-auto deck:w-[min(100cqw,calc(100cqh*155/256))]">
            <ChampionCard champion={pick} interactive={false} />
          </div>
        </div>

        <div className="mt-4 flex-none text-center">
          <div className="text-[11px] tracking-[.24em] text-lol-blue-300">
            #{rank} OF {totalChampions} PICKED
          </div>
        </div>

        <div className="mt-3 flex-none">
          <PlacementSplitBar champion={pick} />
        </div>

        <div className="mt-3 flex-none">
          <SidebarStatRows
            size="compact"
            rows={[
              { label: "GAMES", value: games.toLocaleString("en-US") },
              {
                label: "WINRATE",
                value: percent(won, pick.timesPicked),
                valueColor: TOP3_RATE_COLOR,
              },
              {
                label: "1ST RATE",
                value: percent(pick.top1, pick.timesPicked),
                valueColor: FIRST_RATE_COLOR,
              },
              {
                label: "TIME PLAYED",
                value: formatHoursMinutes(stats?.timePlayedSeconds ?? 0),
              },
            ]}
          />
        </div>
      </div>

      <div className="@container flex min-w-0 flex-col md:min-h-0">
        <PanelToolbar
          className="mb-6 flex-none"
          caption={
            best
              ? "SINGLE-MATCH RECORDS"
              : `ACROSS ${games.toLocaleString("en-US")} GAME${games === 1 ? "" : "S"}`
          }
        >
          <DiamondTabs
            tabs={[
              { key: "total", label: "TOTAL" },
              { key: "best", label: "BEST GAME" },
            ]}
            active={mode}
            onChange={setMode}
          />
        </PanelToolbar>

        {/* `content-start` rather than a stretched grid so a short group
          leaves blank space under itself instead of stretching every row
          to match the tallest one — except in deck mode at four columns,
          where the bottom row (finishes, items, augments) takes whatever
          height is left so the grid fills the panel and the lists scroll
          inside it. Every gap is the panel's own 24px padding. Columns kick in earlier than a typical
          card grid (@sm/@lg/@2xl rather than @2xl/@6xl) — at the 1280×860
          deck-mode floor (CLAUDE.md's own minimum test size) the stat area
          is ~776px wide, so @2xl (672px) is what actually reaches 4 columns
          there instead of needing a much wider monitor — so this fits inside
          the panel's single-screen height on realistic window widths instead
          of stacking all ten groups in one column and needing to scroll. */}
        <div className="grid grid-flow-row-dense grid-cols-1 content-start gap-6 @sm:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 deck:min-h-0 deck:flex-1 deck:@2xl:grid-rows-[auto_auto_minmax(10rem,1fr)]">
          {/* Above Finishes, so the two placement views share a column. */}
          <StatGroup
            title="FORM"
            aside={stats ? `${stats.form.games.length} GAMES` : undefined}
          >
            {stats && stats.form.games.length > 0 ? (
              <FormChart
                key={stats.championId}
                form={stats.form}
                maxPlacement={stats.placementCounts.length}
              />
            ) : null}
          </StatGroup>

          {/* The four stat groups split the other three columns evenly. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 @sm:col-span-2 @sm:grid-cols-2 @lg:col-span-2 @2xl:col-span-3 @2xl:grid-cols-4">
            <StatGroup title="COMBAT">
              <StatLine
                label="KILLS"
                value={<Num value={(best ? kda?.mostKills : kda?.totalKills) ?? 0} />}
              />
              <StatLine
                label="DEATHS"
                value={<Num value={(best ? kda?.mostDeaths : kda?.totalDeaths) ?? 0} />}
              />
              <StatLine
                label="ASSISTS"
                value={
                  <Num value={(best ? kda?.mostAssists : kda?.totalAssists) ?? 0} />
                }
              />
              <StatLine
                label="KDA"
                note={
                  best && bestGame
                    ? `${bestGame.kills}/${bestGame.deaths}/${bestGame.assists}`
                    : undefined
                }
                value={
                  <AnimatedNumber
                    value={best ? bestKda : careerKda}
                    decimals={2}
                    durationMs={700}
                  />
                }
              />
              <StatLine
                label="BIGGEST CRIT"
                value={<Num value={combat?.largestCriticalStrike ?? 0} compact />}
              />
            </StatGroup>

            <StatGroup title="MULTIKILLS">
              <StatLine
                label="DOUBLE"
                value={
                  <Num
                    value={(best ? combat?.mostDoubleKills : combat?.doubleKills) ?? 0}
                  />
                }
              />
              <StatLine
                label="TRIPLE"
                value={
                  <Num
                    value={(best ? combat?.mostTripleKills : combat?.tripleKills) ?? 0}
                  />
                }
              />
              <StatLine
                label="QUADRA"
                value={
                  <Num
                    value={(best ? combat?.mostQuadraKills : combat?.quadraKills) ?? 0}
                  />
                }
              />
              <StatLine
                label="PENTA"
                value={
                  <Num
                    value={(best ? combat?.mostPentaKills : combat?.pentaKills) ?? 0}
                  />
                }
              />
              <StatLine
                label="SOLO KILLS"
                value={
                  <Num value={(best ? kda?.mostSoloKills : kda?.soloKills) ?? 0} />
                }
              />
              <StatLine
                label="BEST SPREE"
                value={<Num value={kda?.largestKillingSpree ?? 0} />}
              />
            </StatGroup>

            <StatGroup title="UTILITY">
              <StatLine
                label="HEAL & SHIELD"
                value={<Num value={utility?.healingAndShielding ?? 0} compact />}
                valueColor={HEAL_COLOR}
              />
              <StatLine
                label="CC SCORE"
                value={<Num value={utility?.ccScoreSeconds ?? 0} compact />}
                valueColor={CC_COLOR}
              />
              <StatLine
                label="CC TIME DEALT"
                value={formatDuration(utility?.ccTimeDealt ?? 0)}
              />
              <StatLine
                label="SAVES"
                value={<Num value={utility?.savesFromDeath ?? 0} />}
              />
              <StatLine
                label="SELF-MITIGATED"
                value={
                  <Num
                    value={
                      (best
                        ? combat?.bestDamageSelfMitigated
                        : combat?.damageSelfMitigated) ?? 0
                    }
                    compact
                  />
                }
              />
            </StatGroup>

            <StatGroup title="ECONOMY">
              <StatLine
                label="GOLD EARNED"
                value={
                  <Num
                    value={
                      (best ? economy?.bestGameGoldEarned : economy?.goldEarned) ?? 0
                    }
                    compact
                  />
                }
                valueColor="#c8aa6e"
              />
              <StatLine
                label="ITEMS BOUGHT"
                value={
                  <Num
                    value={
                      (best ? economy?.mostItemsPurchased : economy?.itemsPurchased) ??
                      0
                    }
                  />
                }
              />
              <StatLine
                label="LONGEST GAME"
                value={formatDuration(stats?.longestGameSeconds ?? 0)}
              />
            </StatGroup>
          </div>

          <StatGroup title="DAMAGE DEALT">
            <CompositionDonut
              slices={damageSlices(damageDealt)}
              format={compact}
              caption={perGame(sumDamageBreakdown(damageDealt), compact)}
            />
          </StatGroup>

          <StatGroup title="DAMAGE TAKEN">
            <CompositionDonut
              slices={damageSlices(damageTaken)}
              format={compact}
              caption={perGame(sumDamageBreakdown(damageTaken), compact)}
            />
          </StatGroup>

          <StatGroup title="ABILITY CASTS">
            <CompositionDonut
              slices={castSlices(casts)}
              format={plain}
              caption={perGame(sumCasts(casts), plain)}
            />
          </StatGroup>

          <StatGroup title="ANVILS">
            <CompositionDonut
              slices={[
                {
                  key: "stat",
                  label: "STAT",
                  value: anvils.stat,
                  color: ANVIL_COLORS.stat,
                },
                {
                  key: "legendary",
                  label: "LEGENDARY",
                  value: anvils.legendary,
                  color: ANVIL_COLORS.legendary,
                },
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  value: anvils.prismatic,
                  color: ANVIL_COLORS.prismatic,
                },
              ]}
              format={plain}
              caption={perGame(anvils.stat + anvils.legendary + anvils.prismatic, (v) =>
                v.toFixed(1),
              )}
            />
          </StatGroup>

          {/* First column of the bottom row, under the form chart, with the
            item and augment lists beside it. */}
          <StatGroup
            title="FINISHES"
            aside={
              stats ? `AVG ${stats.avgPlacement.toFixed(2)}` : undefined
            }
          >
            <FinishesChart counts={stats?.placementCounts ?? []} />
          </StatGroup>

          {/* Items and augments split the rest of the row evenly. */}
          <div className="grid min-h-0 grid-cols-1 gap-6 @sm:col-span-2 @lg:col-span-3 @lg:grid-cols-2">
            <PickListGroup
              title="ITEMS"
              tabs={[
                {
                  key: "legendary",
                  label: "LEGENDARY",
                  color: ANVIL_COLORS.legendary,
                  rows: itemEntries(items?.legendary),
                  verb: "built",
                  noun: "ITEMS",
                  empty: "NO LEGENDARY ITEMS BUILT",
                },
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  color: ANVIL_COLORS.prismatic,
                  rows: itemEntries(items?.prismatic),
                  verb: "held at the end",
                  noun: "ITEMS",
                  empty: "NO PRISMATIC ITEMS HELD",
                },
                {
                  key: "special",
                  label: "SPECIAL",
                  color: SPECIAL_COLOR,
                  rows: itemEntries(items?.special),
                  verb: "held at the end",
                  noun: "ITEMS",
                  empty: "NO SPECIAL ITEMS HELD",
                },
                {
                  key: "boots",
                  label: "BOOTS",
                  color: ANVIL_COLORS.stat,
                  rows: itemEntries(items?.boots),
                  verb: "bought",
                  noun: "BOOTS",
                  empty: "NEVER BOUGHT BOOTS",
                },
              ]}
            />
            <PickListGroup
              title="AUGMENTS"
              round
              tabs={[
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  color: ANVIL_COLORS.prismatic,
                  rows: augmentEntries(stats?.augments, 2),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO PRISMATIC AUGMENTS PICKED",
                },
                {
                  key: "gold",
                  label: "GOLD",
                  color: ANVIL_COLORS.legendary,
                  rows: augmentEntries(stats?.augments, 1),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO GOLD AUGMENTS PICKED",
                },
                {
                  key: "silver",
                  label: "SILVER",
                  color: ANVIL_COLORS.stat,
                  rows: augmentEntries(stats?.augments, 0),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO SILVER AUGMENTS PICKED",
                },
              ]}
            />
          </div>

        </div>
      </div>
    </div>
  );
}
