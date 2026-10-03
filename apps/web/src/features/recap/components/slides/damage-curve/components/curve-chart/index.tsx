"use client";

import { motion, useReducedMotion } from "motion/react";
import { useId } from "react";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { HoverCardRows, HoverCardSection, HoverStatCard } from "@/features/recap/components/hover-stat-card";
import type { DamageCurvePoint } from "@/features/recap/components/slides/damage-curve/types";
import { formatDamage, pointTotal } from "@/features/recap/components/slides/damage-curve/utils";
import { DAMAGE_TYPE_COLORS, DAMAGE_TYPE_KEYS, DAMAGE_TYPE_LABELS } from "@/features/recap/utils/damage-types";
import { useChartHover } from "@/hooks/use-chart-hover";
import { useSectionInView } from "@/hooks/use-section-in-view";
import { FILL_DURATION_S, MARGIN } from "./constants";
import { useElementSize } from "./hooks";
import { yAxisTicks } from "./utils";

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
  const x = (minute: number) => MARGIN.left + (minute / lastMinute) * innerWidth;
  const y = (value: number) => MARGIN.top + innerHeight - (value / yMax) * innerHeight;

  // Each layer's lower and upper edge per minute (cumulative stack).
  const layers = DAMAGE_TYPE_KEYS.map((key, layerIndex) => {
    const below = (point: DamageCurvePoint) =>
      DAMAGE_TYPE_KEYS.slice(0, layerIndex).reduce((sum, k) => sum + point[k], 0);
    const top = points.map((point) => [x(point.minute), y(below(point) + point[key])] as const);
    const bottom = points.map((point) => [x(point.minute), y(below(point))] as const);
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
  const xTicks = Array.from({ length: Math.floor(lastMinute / xStep) + 1 }, (_, i) => i * xStep);

  const hoveredMinute = hover?.id ?? null;
  const hovered = hoveredMinute !== null ? points[hoveredMinute] : null;
  const previous = hoveredMinute !== null && hoveredMinute > 0 ? points[hoveredMinute - 1] : null;
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
              <linearGradient key={layer.key} id={`${clipId}-${layer.key}-fill`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={DAMAGE_TYPE_COLORS[layer.key]} stopOpacity={0.75} />
                <stop offset="100%" stopColor={DAMAGE_TYPE_COLORS[layer.key]} stopOpacity={0.3} />
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
                const stacked = DAMAGE_TYPE_KEYS.slice(0, layerIndex + 1).reduce((sum, k) => sum + hovered[k], 0);
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
                  value: <span style={{ color: DAMAGE_TYPE_COLORS[key] }}>{formatDamage(hovered[key])}</span>,
                }))}
              />
            </HoverCardSection>
            <HoverCardSection label="THIS MINUTE">
              <HoverCardRows
                rows={[
                  {
                    label: "DEALT",
                    value: formatDamage(previous ? pointTotal(hovered) - pointTotal(previous) : 0),
                  },
                  {
                    label: "OF THE FINAL TOTAL",
                    value: final > 0 ? `${((pointTotal(hovered) / final) * 100).toFixed(0)}%` : "—",
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

export { CurveChart };
