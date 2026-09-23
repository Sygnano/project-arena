"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import type { NemesisStats, OpponentStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { DetailBand } from "@/components/detail-band";
import { formatSignedPoints } from "@/components/delta-cell";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { SortHeaderLabel } from "@/components/sortable-stat-row";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = NemesisStats & {
  /** How often ANY opponent's team would finish ahead of yours given your
   * own placements (0-100): `(avgPlacement - 1) / (teams - 1)`. The
   * reference point for "beats you" — in a 6-team lobby a random opponent
   * finishes ahead of an average player about half the time. */
  expectedBeatenByRate: number;
};

type SortMetric =
  | "ownTop1"
  | "ownTop3"
  | "roundsWon"
  | "games"
  | "roundsLost"
  | "top3Rate"
  | "vsYou";
type SortDir = "asc" | "desc";

/** Metrics that are plain counts rather than rates: they sort straight on
 * their value, with no `MIN_SAMPLE` demotion or dimming (a row's own count
 * IS its sample, so there's nothing to be noisy about). */
const COUNT_METRICS: readonly SortMetric[] = [
  "games",
  "roundsWon",
  "roundsLost",
];

// An opponent needs at least this many shared matches before they're
// eligible for the sidebar's "BIGGEST NEMESIS" figure — same reasoning as
// Teammates' MIN_GAMES_FOR_BEST_DUO: a single unlucky loss to a
// rarely-repeated opponent would otherwise read as a "100%" nemesis off a
// sample of one.
const MIN_GAMES_FOR_NEMESIS = 5;

const TOP3_RATE_COLOR = "#e0b563";
const VS_YOU_COLOR = "var(--color-lol-garnet)";

function top3Rate(row: OpponentStats): number {
  return row.gamesFaced > 0
    ? ((row.top1 + row.top3ExclTop1) / row.gamesFaced) * 100
    : 0;
}

/** This opponent's win rate specifically AGAINST the summoner (their team
 * finishing ahead of the summoner's team) — the actual "nemesis" number,
 * distinct from `top3Rate` (their own overall placement record). */
function vsYouRate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? (row.timesBeatenBy / row.gamesFaced) * 100 : 0;
}

/** The summoner's OWN win rate (top 3 finish) across the matches shared with
 * this opponent — mirrors `top3Rate` above, but for the summoner's team. */
function ownTop3Rate(row: OpponentStats): number {
  return row.gamesFaced > 0
    ? ((row.ownTop1 + row.ownTop3ExclTop1) / row.gamesFaced) * 100
    : 0;
}

/** The summoner's OWN 1st-place rate across the matches shared with this
 * opponent. */
function ownTop1Rate(row: OpponentStats): number {
  return row.gamesFaced > 0 ? (row.ownTop1 / row.gamesFaced) * 100 : 0;
}

function metricValue(row: OpponentStats, metric: SortMetric): number {
  switch (metric) {
    case "games":
      return row.gamesFaced;
    case "roundsWon":
      return row.roundsWon;
    case "roundsLost":
      return row.roundsLost;
    case "ownTop1":
      return ownTop1Rate(row);
    case "ownTop3":
      return ownTop3Rate(row);
    case "top3Rate":
      return top3Rate(row);
    default:
      return vsYouRate(row);
  }
}

const YOU_COLOR = "var(--color-lol-blue-300)";

/** our 1st · our winrate · you count · you bar · opponent · them bar ·
 * them count · their winrate · ahead. The two outer pairs of rate columns
 * mirror each other (our own record vs. this opponent's own record in the
 * same shared matches), framing the round-duel tug-of-war in the middle.
 * The bars are round duels won by each side (`roundsWon`/`roundsLost`),
 * growing outward from the name on one shared scale, so a row's combined
 * span is the number of rounds fought against that opponent. */
const ROW_GRID =
  "72px 64px 36px minmax(0,1fr) 190px minmax(0,1fr) 36px 64px 72px";

/**
 * Nemesis — the "opposing team" counterpart to `Teammates`: every Riot
 * account the summoner has shared a tracked match with on a DIFFERENT team.
 * Each row is a head-to-head tug-of-war around the opponent's name (the same
 * twin-bar shape as Utility): round duels you won grow left, duels they won
 * grow right. Duels come from timelines (see `parseRounds()` in @arena/db). `vsYouRate` lights up garnet only above
 * `expectedBeatenByRate` — beating that is what makes someone a nemesis
 * rather than a frequently-seen name.
 */
const Nemesis = ({
  opponents,
  totalOpponents,
  expectedBeatenByRate,
}: Props) => {
  const [metric, setMetric] = useState<SortMetric>("games");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Rate sorts: rank rows under MIN_SAMPLE with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");

  const sortBy = (m: SortMetric) => {
    if (m === metric) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setMetric(m);
      setSortDir("desc");
    }
  };

  const isCountMetric = COUNT_METRICS.includes(metric);

  const rows = useMemo(() => {
    if (COUNT_METRICS.includes(metric)) {
      const dirSign = sortDir === "desc" ? 1 : -1;
      return [...opponents].sort(
        (a, b) =>
          dirSign * (metricValue(b, metric) - metricValue(a, metric)) ||
          b.gamesFaced - a.gamesFaced,
      );
    }
    return sortByRate(
      opponents,
      (row) => metricValue(row, metric),
      (row) => row.gamesFaced,
      sortDir,
      mixLowSample ? "mixed" : "after",
    );
  }, [opponents, metric, sortDir, mixLowSample]);

  const [selectedId, setSelectedId] = useState<number | null>(
    () => rows[0]?.id ?? null,
  );
  const selected =
    opponents.find((o) => o.id === selectedId) ?? rows[0] ?? null;

  // Bars start empty and grow in once mounted.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Rounds fought is a count, not a rate: every row sets the scale.
  const maxRounds = Math.max(
    1,
    ...opponents.map((o) => o.roundsWon + o.roundsLost),
  );

  const mostFaced = opponents.reduce(
    (max, o) => Math.max(max, o.gamesFaced),
    0,
  );
  const biggestNemesis = opponents
    .filter((o) => o.gamesFaced >= MIN_GAMES_FOR_NEMESIS)
    .reduce<OpponentStats | null>(
      (worst, o) =>
        worst === null || vsYouRate(o) > vsYouRate(worst) ? o : worst,
      null,
    );

  const lowSampleNote = ` · UNDER ${MIN_SAMPLE} GAMES DIMMED`;
  const modeCaption: string = {
    games: "SORTED · BY GAMES FACED",
    roundsWon: "SORTED · BY ROUNDS YOU WON",
    roundsLost: "SORTED · BY ROUNDS THEY WON",
    ownTop1: `SORTED · BY YOUR 1ST RATE${lowSampleNote}`,
    ownTop3: `SORTED · BY YOUR WINRATE${lowSampleNote}`,
    top3Rate: `SORTED · BY THEIR WINRATE${lowSampleNote}`,
    vsYou: `SORTED · BY HOW OFTEN THEY FINISH AHEAD OF YOU · EXPECTED ~${expectedBeatenByRate.toFixed(0)}%`,
  }[metric];

  /** Every numeric column doubles as a sort control; clicking the active one
   * flips direction. Rendered by a function call rather than a nested
   * component so a re-sort doesn't remount the buttons (and drop focus). */
  const sortHeader = (
    key: SortMetric,
    label: string,
    {
      align = "right",
      color,
      span,
    }: {
      align?: "left" | "center" | "right";
      color?: string;
      span?: boolean;
    } = {},
  ) => (
    <button
      type="button"
      className={cn(
        "cursor-pointer select-none hover:opacity-100",
        span && "col-span-2",
        align === "left"
          ? "text-left"
          : align === "center"
            ? "text-center"
            : "text-right",
      )}
      style={{ color, opacity: metric === key ? 1 : 0.55 }}
      onClick={() => sortBy(key)}
    >
      <SortHeaderLabel label={label} active={metric === key} dir={sortDir} />
    </button>
  );


  return (
    <CategorySection
      title="NEMESIS"
      description={`Opponents faced at least twice. Given your own placements, any opponent would finish ahead of you about ${expectedBeatenByRate.toFixed(0)}% of the time: a real nemesis beats that.`}
      quote="I can see the fear in your heart."
      imageUrl={SECTION_BACKGROUNDS.nemesis}
      sidebar={
        <>
          <Dial
            value={biggestNemesis ? vsYouRate(biggestNemesis) : 0}
            label="AHEAD OF YOU"
            formatValue={(v) => `${v.toFixed(0)}%`}
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "OPPONENTS FACED",
                  value: totalOpponents.toLocaleString(),
                },
                { label: "MOST FACED", value: mostFaced.toLocaleString() },
                {
                  label: "BIGGEST NEMESIS",
                  value: biggestNemesis?.riotIdGameName ?? "—",
                  valueColor: VS_YOU_COLOR,
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={660}>
        <PanelToolbar
          caption={modeCaption}
          trailing={
            !COUNT_METRICS.includes(metric) ? (
              <LowSampleSwitch
                checked={mixLowSample}
                onChange={setMixLowSample}
              />
            ) : null
          }
        >
          <DiamondTabs
            tabs={[
              { key: "games", label: "MOST FACED" },
              { key: "top3Rate", label: "WINRATE" },
              { key: "vsYou", label: "AHEAD OF YOU" },
            ]}
            active={metric}
            onChange={sortBy}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 px-1.5 pb-2"
          style={{
            gridTemplateColumns: ROW_GRID,
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          {sortHeader("ownTop1", "1ST", { align: "left", color: YOU_COLOR })}
          {sortHeader("ownTop3", "WINRATE", {
            align: "left",
            color: YOU_COLOR,
          })}
          {sortHeader("roundsWon", "◀ ROUNDS YOU WON", {
            color: YOU_COLOR,
            span: true,
          })}
          {sortHeader("games", "GAMES", { align: "center" })}
          {sortHeader("roundsLost", "ROUNDS THEY WON ▶", {
            align: "left",
            color: VS_YOU_COLOR,
            span: true,
          })}
          {sortHeader("top3Rate", "WINRATE", { color: TOP3_RATE_COLOR })}
          {sortHeader("vsYou", "AHEAD", { color: VS_YOU_COLOR })}
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col justify-start gap-1 overflow-y-auto py-1.5 pr-1"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(200,170,110,.45) transparent",
            }}
          >
            {rows.map((opponent, index) => {
              const isSelected = opponent.id === selectedId;
              const lowSample =
                !isCountMetric && isLowSample(opponent.gamesFaced);
              const aheadRate = vsYouRate(opponent);
              const youPct = grown ? (opponent.roundsWon / maxRounds) * 100 : 0;
              const themPct = grown
                ? (opponent.roundsLost / maxRounds) * 100
                : 0;
              return (
                // Keyed by rank, like Utility's bar layer: a re-sort keeps
                // each slot in place and tweens its bars to the new opponent.
                <div
                  key={index}
                  {...pressable(() => setSelectedId(opponent.id), {
                    pressed: isSelected,
                  })}
                  aria-label={`${opponent.riotIdGameName}: faced ${opponent.gamesFaced} times, rounds won ${opponent.roundsWon} to ${opponent.roundsLost}`}
                  className={cn(
                    "grid cursor-pointer items-center gap-4 px-1.5 py-1 transition-[background,opacity] duration-150",
                    lowSample && "opacity-45",
                  )}
                  style={{
                    gridTemplateColumns: ROW_GRID,
                    background: isSelected
                      ? "rgba(200,170,110,.09)"
                      : "transparent",
                    boxShadow: isSelected
                      ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                      : undefined,
                  }}
                >
                  <div
                    className="text-left font-display text-[16px]"
                    style={{ color: YOU_COLOR }}
                  >
                    {ownTop1Rate(opponent).toFixed(0)}%
                  </div>
                  <div
                    className="text-left font-display text-[16px]"
                    style={{ color: YOU_COLOR }}
                  >
                    {ownTop3Rate(opponent).toFixed(0)}%
                  </div>

                  <div
                    className="text-right font-display text-[16px]"
                    style={{ color: YOU_COLOR }}
                  >
                    {opponent.roundsWon}
                  </div>

                  <div
                    className="relative h-2.5"
                    style={{ background: "rgba(240,230,210,.05)" }}
                  >
                    <div
                      className="absolute inset-y-0 right-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${youPct}%`,
                        background: YOU_COLOR,
                        boxShadow: "0 0 10px rgba(10,200,185,.45)",
                      }}
                    />
                  </div>

                  <div className="flex min-w-0 items-center justify-center gap-2.5">
                    <div className="min-w-0 text-center">
                      <div
                        className="font-body truncate text-[15px] leading-tight"
                        style={{
                          color: "var(--color-lol-gold-50)",
                        }}
                        title={`${opponent.riotIdGameName} #${opponent.riotIdTagline}`}
                      >
                        {opponent.riotIdGameName}
                      </div>
                      <div className="truncate text-[11px] tracking-[.1em] text-lol-text-muted">
                        #{opponent.riotIdTagline} ·{" "}
                        {opponent.gamesFaced.toLocaleString()}{" "}
                        {opponent.gamesFaced === 1 ? "GAME" : "GAMES"}
                      </div>
                    </div>
                  </div>

                  <div
                    className="relative h-2.5"
                    style={{ background: "rgba(240,230,210,.05)" }}
                  >
                    <div
                      className="absolute inset-y-0 left-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${themPct}%`,
                        background: VS_YOU_COLOR,
                        boxShadow: "0 0 10px rgba(201,138,163,.45)",
                      }}
                    />
                  </div>

                  <div
                    className="text-left font-display text-[16px]"
                    style={{ color: VS_YOU_COLOR }}
                  >
                    {opponent.roundsLost}
                  </div>

                  <div
                    className="text-right font-display text-[16px]"
                    style={{ color: TOP3_RATE_COLOR }}
                  >
                    {top3Rate(opponent).toFixed(0)}%
                  </div>
                  <div
                    className="text-right font-display text-[16px]"
                    style={{
                      color:
                        aheadRate > expectedBeatenByRate
                          ? VS_YOU_COLOR
                          : "var(--color-lol-text-muted)",
                    }}
                    title={`Expected ~${expectedBeatenByRate.toFixed(0)}%`}
                  >
                    {aheadRate.toFixed(0)}%
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selected ? (
          <DetailBand
            icon={
              <div
                className="flex h-15.5 w-15.5 flex-none items-center justify-center border font-display text-2xl text-lol-text-muted"
                style={{ borderColor: "rgba(200,170,110,.6)" }}
              >
                {selected.riotIdGameName.charAt(0).toUpperCase()}
              </div>
            }
            title={`${selected.riotIdGameName} #${selected.riotIdTagline}`}
            subtitle={`${selected.gamesFaced.toLocaleString()} GAMES FACED`}
            stats={[
              {
                label: "ROUNDS YOU – THEM",
                value: `${selected.roundsWon} – ${selected.roundsLost}`,
                highlight: isCountMetric,
                bordered: false,
                nowrap: true,
              },
              {
                label: "FINISHED AHEAD",
                value: `${selected.timesBeat} – ${selected.timesBeatenBy}`,
                nowrap: true,
              },
              {
                label: "WINRATE",
                value: `${top3Rate(selected).toFixed(0)}%`,
                highlight: metric === "top3Rate",
              },
              {
                label: "AHEAD VS EXPECTED",
                value: formatSignedPoints(
                  vsYouRate(selected) - expectedBeatenByRate,
                  0,
                ),
                highlight: metric === "vsYou",
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { Nemesis };
