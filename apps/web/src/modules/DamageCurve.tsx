"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { motion, useReducedMotion } from "motion/react";
import type {
  DamageCurve as Curve,
  DamageCurveSeries,
  DamageCurveStats,
} from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { CursorTooltip } from "@/components/cursor-tooltip";
import {
  HoverStatCard,
  HoverCardRows,
  HoverCardSection,
} from "@/components/hover-stat-card";
import { championIconUrl } from "@/lib/riot";
import { formatCompact, ordinal } from "@/lib/format";
import { pressable } from "@/lib/a11y";
import { useChampionName } from "@/lib/champion-names";
import { isLowSample, MIN_SAMPLE, sortByRate } from "@/lib/sample";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import {
  DAMAGE_TYPE_COLORS,
  DAMAGE_TYPE_KEYS,
  DAMAGE_TYPE_LABELS,
} from "@/lib/damage-types";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { useChartHover } from "@/hooks/use-chart-hover";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { useWheelForwardsTo } from "@/hooks/use-wheel-forwards-to";
import { useSectionInView } from "@/hooks/use-section-in-view";

type Props = {
  damageCurves: DamageCurveStats;
};

type Mode = "total" | "average" | "best";
type Selection = "all" | number;

const MODE_LABEL: Record<Mode, string> = {
  total: "TOTAL",
  average: "AVERAGE",
  best: "BEST GAME",
};

/** Cumulative damage to champions at one minute of a match. */
type DamageCurvePoint = {
  minute: number;
  physical: number;
  magical: number;
  trueDamage: number;
};

/** The API sends one array per damage type (index = minute); the chart
 * reads a point per minute. `divisor` turns TOTAL into AVERAGE. */
function toPoints(series: DamageCurveSeries, divisor = 1): DamageCurvePoint[] {
  return series.physical.map((physical, minute) => ({
    minute,
    physical: physical / divisor,
    magical: (series.magical[minute] ?? 0) / divisor,
    trueDamage: (series.trueDamage[minute] ?? 0) / divisor,
  }));
}

function pointTotal(point: DamageCurvePoint): number {
  return point.physical + point.magical + point.trueDamage;
}

/** Rounded first: average-mode values are fractional. */
function formatDamage(value: number): string {
  return formatCompact(Math.round(value));
}

function formatMinutes(minutes: number): string {
  const whole = Math.floor(minutes);
  const seconds = Math.round((minutes - whole) * 60);
  return seconds === 60
    ? `${whole + 1}:00`
    : `${whole}:${String(seconds).padStart(2, "0")}`;
}

type Findings = {
  final: number;
  /** Fractional minute the curve crosses half of `final`, interpolated
   * between the two minutes around it. */
  halfMinute: number;
  byMinute10: number;
  byMinute20: number;
  /** The one-minute stretch that added the most damage, ending at `minute`. */
  peak: { minute: number; dealt: number };
};

function findings(points: readonly DamageCurvePoint[]): Findings {
  const totals = points.map(pointTotal);
  const final = totals[totals.length - 1] ?? 0;
  let halfMinute = 0;
  for (let i = 1; i < totals.length; i++) {
    if (totals[i] >= final / 2) {
      const previous = totals[i - 1];
      const step = totals[i] - previous;
      halfMinute = i - 1 + (step > 0 ? (final / 2 - previous) / step : 0);
      break;
    }
  }
  let peak = { minute: 0, dealt: 0 };
  for (let i = 1; i < totals.length; i++) {
    const dealt = totals[i] - totals[i - 1];
    if (dealt > peak.dealt) peak = { minute: i, dealt };
  }
  const at = (minute: number) =>
    totals[Math.min(minute, totals.length - 1)] ?? 0;
  return { final, halfMinute, byMinute10: at(10), byMinute20: at(20), peak };
}

/** Y-axis ticks: a round step (1, 2, 2.5 or 5 x 10^n) giving 4-7 intervals,
 * whichever leaves the least empty space above `value` — a plain "next round
 * number" put 16.2M on a 20M axis, wasting a fifth of the chart. */
function yAxisTicks(value: number): number[] {
  if (value <= 0) return [0, 1];
  let best: { step: number; count: number } | null = null;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const scale of [magnitude / 10, magnitude]) {
    for (const multiple of [1, 2, 2.5, 5]) {
      const step = multiple * scale;
      const count = Math.ceil(value / step);
      if (count < 4 || count > 7) continue;
      if (!best || step * count < best.step * best.count)
        best = { step, count };
    }
  }
  const { step, count } = best ?? {
    step: magnitude,
    count: Math.ceil(value / magnitude),
  };
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

const MARGIN = { top: 14, right: 18, bottom: 30, left: 58 };
const FILL_DURATION_S = 1.4;

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

/**
 * The stacked area chart: physical at the bottom, magical on it, true on
 * top, so the top edge is the total. On arrival, and again on every switch
 * of champion or mode, all three layers wipe in left to right together
 * (one shared clip), so the curve draws itself along the match's timeline.
 */
function CurveChart({
  points,
  animationKey,
  outMinute,
}: {
  points: readonly DamageCurvePoint[];
  animationKey: string;
  /** BEST GAME: when the player's team was knocked out, if before the end. */
  outMinute: number | null;
}) {
  const [sizeRef, { width, height }] = useElementSize<HTMLDivElement>();
  const [viewRef, inView] = useSectionInView<HTMLDivElement>();
  const reduceMotion = useReducedMotion();
  const clipId = useId();
  const { hover, setHover, containerRef } = useChartHover<number>();

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);
  const lastMinute = Math.max(1, points.length - 1);
  const yTicks = yAxisTicks(Math.max(...points.map(pointTotal), 0));
  const yMax = yTicks[yTicks.length - 1];
  const x = (minute: number) =>
    MARGIN.left + (minute / lastMinute) * innerWidth;
  const y = (value: number) =>
    MARGIN.top + innerHeight - (value / yMax) * innerHeight;

  // Each layer's lower and upper edge per minute (cumulative stack).
  const layers = DAMAGE_TYPE_KEYS.map((key, layerIndex) => {
    const below = (point: DamageCurvePoint) =>
      DAMAGE_TYPE_KEYS.slice(0, layerIndex).reduce(
        (sum, k) => sum + point[k],
        0,
      );
    const top = points.map(
      (point) => [x(point.minute), y(below(point) + point[key])] as const,
    );
    const bottom = points.map(
      (point) => [x(point.minute), y(below(point))] as const,
    );
    const area =
      `M${top.map(([px, py]) => `${px},${py}`).join("L")}` +
      `L${[...bottom]
        .reverse()
        .map(([px, py]) => `${px},${py}`)
        .join("L")}Z`;
    const edge = `M${top.map(([px, py]) => `${px},${py}`).join("L")}`;
    return { key, area, edge };
  });

  const xStep = lastMinute > 30 ? 10 : 5;
  const xTicks = Array.from(
    { length: Math.floor(lastMinute / xStep) + 1 },
    (_, i) => i * xStep,
  );

  const hoveredMinute = hover?.id ?? null;
  const hovered = hoveredMinute !== null ? points[hoveredMinute] : null;
  const previous =
    hoveredMinute !== null && hoveredMinute > 0
      ? points[hoveredMinute - 1]
      : null;
  const final = pointTotal(points[points.length - 1] ?? points[0]);

  const onPointer = (event: React.PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const minute = Math.round(Math.min(1, Math.max(0, ratio)) * lastMinute);
    setHover({ id: minute, point: { x: event.clientX, y: event.clientY } });
  };

  const animate = !reduceMotion;

  return (
    <div
      ref={(el) => {
        sizeRef.current = el;
        viewRef.current = el;
        containerRef.current = el;
      }}
      className="relative h-full min-h-0 w-full"
    >
      {width > 0 && height > 0 ? (
        <svg width={width} height={height} className="block overflow-visible">
          <defs>
            {layers.map((layer) => (
              <linearGradient
                key={layer.key}
                id={`${clipId}-${layer.key}-fill`}
                x1="0"
                x2="0"
                y1="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor={DAMAGE_TYPE_COLORS[layer.key]}
                  stopOpacity={0.75}
                />
                <stop
                  offset="100%"
                  stopColor={DAMAGE_TYPE_COLORS[layer.key]}
                  stopOpacity={0.3}
                />
              </linearGradient>
            ))}
            <clipPath id={`${clipId}-clip`}>
              <motion.rect
                key={`${animationKey}-${inView}`}
                x={MARGIN.left}
                y={0}
                height={height}
                initial={animate ? { width: 0 } : false}
                animate={{ width: inView || !animate ? innerWidth + 2 : 0 }}
                transition={{
                  duration: animate ? FILL_DURATION_S : 0,
                  ease: [0.33, 0, 0.2, 1],
                }}
              />
            </clipPath>
          </defs>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                x1={MARGIN.left}
                x2={MARGIN.left + innerWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(200,170,110,.12)"
                strokeDasharray={tick === 0 ? undefined : "2 4"}
              />
              <text
                x={MARGIN.left - 10}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="fill-lol-text-muted font-display text-[12px]"
              >
                {formatDamage(tick)}
              </text>
            </g>
          ))}
          {xTicks.map((tick) => (
            <text
              key={tick}
              x={x(tick)}
              y={MARGIN.top + innerHeight + 20}
              textAnchor="middle"
              className="fill-lol-text-muted font-display text-[12px]"
            >
              {tick}&prime;
            </text>
          ))}

          {layers.map((layer) => (
            <g key={layer.key} clipPath={`url(#${clipId}-clip)`}>
              <path d={layer.area} fill={`url(#${clipId}-${layer.key}-fill)`} />
              <path
                d={layer.edge}
                fill="none"
                stroke={DAMAGE_TYPE_COLORS[layer.key]}
                strokeWidth={1.75}
                strokeLinejoin="round"
                style={{
                  filter: `drop-shadow(0 0 4px ${DAMAGE_TYPE_COLORS[layer.key]}88)`,
                }}
              />
            </g>
          ))}

          {outMinute !== null ? (
            <g>
              <line
                x1={x(outMinute)}
                x2={x(outMinute)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="rgba(240,230,210,.55)"
                strokeDasharray="4 4"
              />
              <text
                x={x(outMinute) - 6}
                y={MARGIN.top + 12}
                textAnchor="end"
                className="fill-lol-gold-100 font-display text-[11px] tracking-[.2em]"
              >
                KNOCKED OUT
              </text>
            </g>
          ) : null}

          {hovered ? (
            <g pointerEvents="none">
              <line
                x1={x(hovered.minute)}
                x2={x(hovered.minute)}
                y1={MARGIN.top}
                y2={MARGIN.top + innerHeight}
                stroke="rgba(240,230,210,.45)"
              />
              {DAMAGE_TYPE_KEYS.map((key, layerIndex) => {
                const stacked = DAMAGE_TYPE_KEYS.slice(
                  0,
                  layerIndex + 1,
                ).reduce((sum, k) => sum + hovered[k], 0);
                return (
                  <circle
                    key={key}
                    cx={x(hovered.minute)}
                    cy={y(stacked)}
                    r={4}
                    fill={DAMAGE_TYPE_COLORS[key]}
                    stroke="#040c14"
                    strokeWidth={1.5}
                    style={{
                      filter: `drop-shadow(0 0 6px ${DAMAGE_TYPE_COLORS[key]})`,
                    }}
                  />
                );
              })}
            </g>
          ) : null}

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={innerWidth}
            height={innerHeight}
            fill="transparent"
            onPointerMove={onPointer}
            onPointerDown={onPointer}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") setHover(null);
            }}
          />
        </svg>
      ) : null}

      <CursorTooltip point={hover?.point ?? null}>
        {hovered ? (
          <HoverStatCard
            title={`MINUTE ${hovered.minute}`}
            meta={formatDamage(pointTotal(hovered))}
            subtitle="Damage dealt so far"
          >
            <HoverCardSection>
              <HoverCardRows
                rows={DAMAGE_TYPE_KEYS.map((key) => ({
                  label: DAMAGE_TYPE_LABELS[key],
                  value: (
                    <span style={{ color: DAMAGE_TYPE_COLORS[key] }}>
                      {formatDamage(hovered[key])}
                    </span>
                  ),
                }))}
              />
            </HoverCardSection>
            <HoverCardSection label="THIS MINUTE">
              <HoverCardRows
                rows={[
                  {
                    label: "DEALT",
                    value: formatDamage(
                      previous ? pointTotal(hovered) - pointTotal(previous) : 0,
                    ),
                  },
                  {
                    label: "OF THE FINAL TOTAL",
                    value:
                      final > 0
                        ? `${((pointTotal(hovered) / final) * 100).toFixed(0)}%`
                        : "—",
                  },
                ]}
              />
            </HoverCardSection>
          </HoverStatCard>
        ) : null}
      </CursorTooltip>
    </div>
  );
}

const LIST_ICON_SIZE = 34;

/** The damage the champion list shows on the right and sorts by: the
 * curve's final value in the active mode. */
function curveDamage(curve: Curve, mode: Mode): number {
  const series = mode === "best" ? curve.bestGame.series : curve.total;
  const last = series.physical.length - 1;
  if (last < 0) return 0;
  const total =
    series.physical[last] + series.magical[last] + series.trueDamage[last];
  return mode === "average" ? total / curve.games : total;
}

/**
 * Damage Curve — how damage to champions piles up over a match, minute by
 * minute, for every game or one champion's. TOTAL stacks every game's curve
 * into the season's (it ends at the season's damage total), AVERAGE divides
 * that by the games, BEST GAME is the single highest-damage game. Games that
 * ended keep their final total, so TOTAL and AVERAGE flatten as matches end.
 */
const DamageCurve = ({ damageCurves }: Props) => {
  const displayName = useChampionName();
  const [mode, setMode] = useState<Mode>("total");
  const [selection, setSelection] = useState<Selection>("all");
  // AVERAGE: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");
  // The wheel anywhere on the panel (over the chart too) scrolls the list.
  const panelRef = useRef<HTMLDivElement>(null);
  useWheelForwardsTo(panelRef, listRef);

  const { all, champions } = damageCurves;
  const sortedChampions = useMemo(
    () =>
      mode === "average"
        ? sortByRate(
            champions,
            (c) => curveDamage(c, mode),
            (c) => c.games,
            "desc",
            mixLowSample ? "mixed" : "after",
          )
        : [...champions].sort(
            (a, b) => curveDamage(b, mode) - curveDamage(a, mode),
          ),
    [champions, mode, mixLowSample],
  );
  // BEST GAME has no "all champions" row (its best game is just the top
  // champion's), so an "all" selection shows the top champion there and
  // comes back when switching to another mode.
  const activeSelection: Selection =
    mode === "best" && selection === "all"
      ? (sortedChampions[0]?.championId ?? "all")
      : selection;
  const selectedChampion =
    activeSelection === "all"
      ? null
      : (champions.find((c) => c.championId === activeSelection) ?? null);
  const curve: Curve | null = selectedChampion ?? all;

  const points = useMemo(() => {
    if (!curve) return [];
    if (mode === "best") return toPoints(curve.bestGame.series);
    return toPoints(curve.total, mode === "average" ? curve.games : 1);
  }, [curve, mode]);

  const facts = useMemo(() => findings(points), [points]);

  if (!curve || points.length === 0) {
    return (
      <CategorySection
        title="DMG CURVE"
        imageUrl={SECTION_BACKGROUNDS.damageCurve}
      >
        <HextechPanel>
          <div className="flex h-full items-center justify-center text-sm text-lol-text-muted">
            No match timelines yet.
          </div>
        </HextechPanel>
      </CategorySection>
    );
  }

  const best = curve.bestGame;
  const bestLastMinute = best.series.physical.length - 1;
  const outMinute =
    mode === "best" && best.timePlayedSeconds / 60 < bestLastMinute - 0.5
      ? best.timePlayedSeconds / 60
      : null;

  const selectionName = selectedChampion
    ? displayName(selectedChampion.championName).toUpperCase()
    : "ALL CHAMPIONS";
  const caption =
    mode === "best"
      ? `BEST GAME · ${displayName(best.championName).toUpperCase()} · ${ordinal(best.placement).toUpperCase()} · ${formatDamage(facts.final)} DMG`
      : `${selectionName} · ${curve.games} GAMES · ENDED GAMES HOLD THEIR FINAL TOTAL`;

  const listRow = (
    key: Selection,
    icon: React.ReactNode,
    name: string,
    games: number,
    damage: number,
  ) => {
    const isSelected = activeSelection === key;
    return (
      <div
        key={key}
        {...pressable(() => setSelection(key), { pressed: isSelected })}
        aria-label={`${name}, ${games} games`}
        className={cn(
          "flex h-12 flex-none cursor-pointer items-center gap-2.5 px-1.5 transition-[background,opacity] duration-150 hover:bg-[rgba(200,170,110,.05)]",
          mode === "average" &&
            key !== "all" &&
            isLowSample(games) &&
            "opacity-45",
        )}
        style={{
          background: isSelected ? "rgba(200,170,110,.09)" : undefined,
          boxShadow: isSelected
            ? "inset 0 0 0 1px rgba(200,170,110,.45)"
            : undefined,
        }}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="truncate font-body text-[14px] leading-tight text-lol-gold-50">
            {name}
          </div>
          <div className="mt-0.5 text-[10px] tracking-[.18em] text-lol-text-muted">
            {games} {games === 1 ? "GAME" : "GAMES"}
          </div>
        </div>
        <div className="flex-none font-display text-[15px] text-lol-gold-100 tabular-nums">
          {formatDamage(damage)}
        </div>
      </div>
    );
  };


  return (
    <CategorySection
      title="DMG CURVE"
      quote="Five day forecast: sunshine, rainbows and bloodshed!"
      imageUrl={SECTION_BACKGROUNDS.damageCurve}
      sidebar={
        <>
          <Dial
            value={facts.final}
            label={
              mode === "total"
                ? "TOTAL DMG"
                : mode === "average"
                  ? "AVG DMG"
                  : "BEST GAME DMG"
            }
            labelPosition="bottom"
            formatValue={formatDamage}
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "BY MINUTE 10",
                  value: formatDamage(facts.byMinute10),
                },
                {
                  label: "BY MINUTE 20",
                  value: formatDamage(facts.byMinute20),
                },
                {
                  label: "BIGGEST MINUTE",
                  value: (
                    <span className="whitespace-nowrap">
                      {formatDamage(facts.peak.dealt)}
                      <span className="ml-2 text-[15px] text-lol-text-muted">
                        {facts.peak.minute - 1}&prime;&ndash;{facts.peak.minute}
                        &prime;
                      </span>
                    </span>
                  ),
                },
                {
                  label: "HALF DEALT BY",
                  value: formatMinutes(facts.halfMinute),
                },
              ]}
            />
          </div>
        </>
      }
    >
      <div ref={panelRef} className="contents">
        <HextechPanel contentMinWidth={720}>
          <PanelToolbar
            caption={
              mode === "average" &&
              activeSelection !== "all" &&
              isLowSample(curve.games)
                ? `${caption} · UNDER ${MIN_SAMPLE} GAMES`
                : caption
            }
            captionKey={`${mode}-${activeSelection}`}
            trailing={
              mode === "average" ? (
                <LowSampleSwitch
                  checked={mixLowSample}
                  onChange={setMixLowSample}
                />
              ) : null
            }
          >
            <DiamondTabs
              tabs={(["total", "average", "best"] as const).map((key) => ({
                key,
                label: MODE_LABEL[key],
              }))}
              active={mode}
              onChange={setMode}
            />
          </PanelToolbar>

          <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] gap-5 pt-2">
            <div
              ref={listRef}
              className="flex min-h-0 flex-col gap-0.75 overflow-y-auto pr-1"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(200,170,110,.45) transparent",
              }}
            >
              {mode !== "best" && all
                ? listRow(
                    "all",
                    <div
                      className="grid flex-none place-items-center border border-[rgba(200,170,110,.5)] font-display text-[11px] text-lol-gold-100"
                      style={{ width: LIST_ICON_SIZE, height: LIST_ICON_SIZE }}
                    >
                      ALL
                    </div>,
                    "All champions",
                    all.games,
                    curveDamage(all, mode),
                  )
                : null}
              {sortedChampions.map((champion) =>
                listRow(
                  champion.championId,
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    loading="lazy"
                    decoding="async"
                    src={championIconUrl(champion.championName)}
                    alt=""
                    width={LIST_ICON_SIZE}
                    height={LIST_ICON_SIZE}
                    className="flex-none"
                  />,
                  displayName(champion.championName),
                  champion.games,
                  curveDamage(champion, mode),
                ),
              )}
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex flex-none items-center gap-5 pl-14">
                {DAMAGE_TYPE_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-[11px] tracking-[.2em] text-lol-text-secondary"
                  >
                    <span
                      className="size-2.5 rotate-45"
                      style={{ background: DAMAGE_TYPE_COLORS[key] }}
                    />
                    {DAMAGE_TYPE_LABELS[key]}
                  </div>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                <CurveChart
                  points={points}
                  animationKey={`${mode}-${activeSelection}`}
                  outMinute={outMinute}
                />
              </div>
            </div>
          </div>
        </HextechPanel>
      </div>
    </CategorySection>
  );
};

export { DamageCurve };
