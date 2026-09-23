"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import type { TeammateStats, TeammatesStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { SortHeaderLabel } from "@/components/sortable-stat-row";
import { DeltaCell, formatSignedPoints } from "@/components/delta-cell";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = TeammatesStats & {
  /** The summoner's own winrate across every tracked game (0-100). */
  baselineTop3Rate: number;
};

type SortMetric = "games" | "top3Rate" | "firstRate";
type SortDir = "asc" | "desc";

// A duo needs at least this many shared matches before it's eligible for the
// sidebar's "BEST DUO" figure — same reasoning as TeamSynergy's own
// TEAM_SYNERGY_MIN_PAIR_SAMPLE: a single lucky top1 with a rarely-repeated
// partner would otherwise read as a "100% win rate" duo off a sample of one.
const MIN_GAMES_FOR_BEST_DUO = 5;

const TOP3_RATE_COLOR = "#e0b563";
const FIRST_RATE_COLOR = "var(--color-augment-prismatic)";

function top3Rate(row: TeammateStats): number {
  return row.gamesPlayed > 0
    ? ((row.top1 + row.top3ExclTop1) / row.gamesPlayed) * 100
    : 0;
}

function firstRate(row: TeammateStats): number {
  return row.gamesPlayed > 0 ? (row.top1 / row.gamesPlayed) * 100 : 0;
}

function metricValue(row: TeammateStats, metric: SortMetric): number {
  if (metric === "games") return row.gamesPlayed;
  if (metric === "top3Rate") return top3Rate(row);
  return firstRate(row);
}

const REST_COLOR = "rgba(240,230,210,.14)";
const BASELINE_COLOR = "var(--color-lol-blue-300)";

/** avatar · name · placement strip · games · top 3 · Δ · 1st. */
const ROW_GRID = "36px minmax(110px,190px) minmax(0,1fr) 52px 56px 76px 48px";

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Teammate avatar — no profile icon is available for matchmade players, so
 * this shows the first letter of their name in the app's usual
 * diamond-cornered frame instead of leaving a blank slot. */
function InitialAvatar({ name }: { name: string }) {
  return (
    <div
      className="flex h-9 w-9 items-center justify-center border font-display text-sm text-lol-text-muted"
      style={{
        borderColor: "rgba(200,170,110,.3)",
        background: "rgba(240,230,210,.03)",
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

/**
 * Teammates — every actual Riot account (not champion, see `TeamSynergy` for
 * that) that has shared the tracked summoner's Arena team across every
 * tracked match. Each row carries a placement strip — the games together
 * split into 1st / 2nd-3rd / 4th+ — with a cyan marker at the summoner's
 * overall winrate, so the Δ column reads at a glance: gold ending past
 * the marker means you place better together.
 */
const Teammates = ({ teammates, totalTeammates, baselineTop3Rate }: Props) => {
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

  // Rate sorts rank only teammates with enough shared games; the rest follow,
  // dimmed (see lib/sample.ts) — a one-game teammate used to top WINRATE.
  const rows = useMemo(() => {
    if (metric === "games") {
      const dirSign = sortDir === "desc" ? 1 : -1;
      return [...teammates].sort(
        (a, b) => dirSign * (b.gamesPlayed - a.gamesPlayed),
      );
    }
    return sortByRate(
      teammates,
      (row) => metricValue(row, metric),
      (row) => row.gamesPlayed,
      sortDir,
      mixLowSample ? "mixed" : "after",
    );
  }, [teammates, metric, sortDir, mixLowSample]);

  const [selectedId, setSelectedId] = useState<number | null>(
    () => rows[0]?.id ?? null,
  );
  const selected =
    teammates.find((t) => t.id === selectedId) ?? rows[0] ?? null;

  // Strips start empty and grow in once mounted.
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const mostGamesTogether = teammates.reduce(
    (max, t) => Math.max(max, t.gamesPlayed),
    0,
  );
  const bestDuo = teammates
    .filter((t) => t.gamesPlayed >= MIN_GAMES_FOR_BEST_DUO)
    .reduce<TeammateStats | null>(
      (best, t) => (best === null || top3Rate(t) > top3Rate(best) ? t : best),
      null,
    );

  const modeCaption =
    metric === "games"
      ? "SORTED · BY GAMES TOGETHER"
      : metric === "top3Rate"
        ? `SORTED · BY WINRATE · UNDER ${MIN_SAMPLE} GAMES DIMMED`
        : `SORTED · BY 1ST RATE · UNDER ${MIN_SAMPLE} GAMES DIMMED`;


  return (
    <CategorySection
      title="TEAMMATES"
      description={`Players who shared your team at least twice. Your overall winrate is ${baselineTop3Rate.toFixed(0)}%, the cyan line on each strip: gold reaching past it means you place better together.`}
      quote="Stick to the plan, Val."
      imageUrl={SECTION_BACKGROUNDS.teammates}
      sidebar={
        <>
          <Dial
            value={totalTeammates}
            label="UNIQUE TEAMMATES"
            formatValue={(v) => v.toLocaleString()}
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "MOST GAMES TOGETHER",
                  value: mostGamesTogether.toLocaleString(),
                },
                {
                  label: bestDuo
                    ? `BEST PARTNER · ${bestDuo.riotIdGameName.toUpperCase()}`
                    : "BEST PARTNER",
                  value: bestDuo ? `${top3Rate(bestDuo).toFixed(0)}%` : "—",
                  valueColor: TOP3_RATE_COLOR,
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={760}>
        <PanelToolbar
          caption={modeCaption}
          trailing={
            metric !== "games" ? (
              <LowSampleSwitch
                checked={mixLowSample}
                onChange={setMixLowSample}
              />
            ) : null
          }
        >
          <DiamondTabs
            tabs={[
              { key: "games", label: "MOST PLAYED" },
              { key: "top3Rate", label: "WINRATE" },
              { key: "firstRate", label: "1ST RATE" },
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
          <div />
          <div className="text-[11px] tracking-[.22em] text-[#a09b8c]">
            TEAMMATE
          </div>
          <div className="flex min-w-0 items-center gap-3.5 overflow-hidden text-[10px] tracking-[.2em] whitespace-nowrap text-[#a09b8c]">
            <LegendSwatch color={FIRST_RATE_COLOR} label="1ST" />
            <LegendSwatch color={TOP3_RATE_COLOR} label="2ND–3RD" />
            <LegendSwatch color={REST_COLOR} label="4TH+" />
            <span
              className="flex items-center gap-1.5"
              style={{ color: BASELINE_COLOR }}
            >
              <span
                className="inline-block h-3 w-px"
                style={{ background: BASELINE_COLOR }}
              />
              YOUR WINRATE · {baselineTop3Rate.toFixed(0)}%
            </span>
          </div>
          <button
            type="button"
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{ opacity: metric === "games" ? 1 : 0.55 }}
            onClick={() => sortBy("games")}
          >
            <SortHeaderLabel
              label="GAMES"
              active={metric === "games"}
              dir={sortDir}
            />
          </button>
          <button
            type="button"
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{
              color: TOP3_RATE_COLOR,
              opacity: metric === "top3Rate" ? 1 : 0.55,
            }}
            onClick={() => sortBy("top3Rate")}
          >
            <SortHeaderLabel
              label="WINRATE"
              active={metric === "top3Rate"}
              dir={sortDir}
            />
          </button>
          <div
            className="text-right text-[11px] tracking-[.22em] text-[#a09b8c]"
            title="Winrate together minus your overall winrate"
          >
            Δ YOU
          </div>
          <button
            type="button"
            className="cursor-pointer text-right select-none hover:opacity-100"
            style={{
              color: FIRST_RATE_COLOR,
              opacity: metric === "firstRate" ? 1 : 0.55,
            }}
            onClick={() => sortBy("firstRate")}
          >
            <SortHeaderLabel
              label="1ST"
              active={metric === "firstRate"}
              dir={sortDir}
            />
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col justify-start gap-0.75 overflow-y-auto py-1.5 pr-1"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "rgba(200,170,110,.45) transparent",
            }}
          >
            {rows.map((teammate, index) => {
              const isSelected = teammate.id === selectedId;
              const delta = top3Rate(teammate) - baselineTop3Rate;
              const lowSample =
                metric !== "games" && isLowSample(teammate.gamesPlayed);
              const games = Math.max(1, teammate.gamesPlayed);
              const segments = [
                {
                  key: "first",
                  color: FIRST_RATE_COLOR,
                  pct: (teammate.top1 / games) * 100,
                },
                {
                  key: "top3",
                  color: TOP3_RATE_COLOR,
                  pct: (teammate.top3ExclTop1 / games) * 100,
                },
                {
                  key: "rest",
                  color: REST_COLOR,
                  pct: (teammate.remaining / games) * 100,
                },
              ];
              return (
                // Keyed by rank: a re-sort keeps each slot in place and
                // tweens its strip to the new teammate's placements.
                <div
                  key={index}
                  {...pressable(() => setSelectedId(teammate.id), {
                    pressed: isSelected,
                  })}
                  aria-label={`${teammate.riotIdGameName}: ${teammate.gamesPlayed} games together, ${teammate.top1} first, ${teammate.top3ExclTop1} second or third, ${teammate.remaining} fourth or lower`}
                  className={cn(
                    "grid cursor-pointer items-center gap-4 px-1.5 py-1.25 transition-[background,opacity] duration-150",
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
                  <InitialAvatar name={teammate.riotIdGameName} />

                  <div className="min-w-0">
                    <div
                      className="font-body truncate text-[16px]"
                      style={{
                        color: "var(--color-lol-gold-50)",
                      }}
                      title={`${teammate.riotIdGameName} #${teammate.riotIdTagline}`}
                    >
                      {teammate.riotIdGameName}
                    </div>
                    <div className="truncate text-[11px] tracking-[.1em] text-lol-text-muted">
                      #{teammate.riotIdTagline}
                    </div>
                  </div>

                  <div
                    className="relative h-3"
                    style={{ background: "rgba(240,230,210,.05)" }}
                  >
                    <div className="absolute inset-0 flex">
                      {segments.map((segment) => (
                        <div
                          key={segment.key}
                          className="h-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                          style={{
                            width: grown ? `${segment.pct}%` : "0%",
                            background: segment.color,
                          }}
                        />
                      ))}
                    </div>
                    {/* Your overall winrate: gold ending past this line
                        means you place better together. */}
                    <div
                      className="absolute -inset-y-1 w-px"
                      style={{
                        left: `${baselineTop3Rate}%`,
                        background: BASELINE_COLOR,
                        boxShadow: "0 0 6px rgba(10,200,185,.8)",
                      }}
                    />
                  </div>

                  <div className="text-right font-display text-[16px] text-lol-text-secondary">
                    {teammate.gamesPlayed.toLocaleString()}
                  </div>
                  <div
                    className={cn("text-right font-display text-[16px]")}
                    style={{ color: TOP3_RATE_COLOR }}
                  >
                    {top3Rate(teammate).toFixed(0)}%
                  </div>
                  <DeltaCell delta={delta} />
                  <div
                    className={cn("text-right font-display text-[16px]")}
                    style={{ color: FIRST_RATE_COLOR }}
                  >
                    {firstRate(teammate).toFixed(0)}%
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
            subtitle={`${selected.gamesPlayed.toLocaleString()} GAMES TOGETHER`}
            stats={[
              {
                label: "WINRATE",
                value: `${top3Rate(selected).toFixed(0)}%`,
                highlight: metric === "top3Rate",
                bordered: false,
              },
              {
                label: "VS YOUR AVERAGE",
                value: formatSignedPoints(
                  top3Rate(selected) - baselineTop3Rate,
                ),
                nowrap: true,
              },
              {
                label: "1ST RATE",
                value: `${firstRate(selected).toFixed(0)}%`,
                highlight: metric === "firstRate",
              },
              {
                label: "ROUNDS WON – LOST",
                value: `${selected.roundsWon} – ${selected.roundsLost}`,
                highlight: metric === "games",
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { Teammates };
