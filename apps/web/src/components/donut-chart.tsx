"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

type Segment = {
  key: string;
  value: number;
  color: string;
};

type Props = {
  segments: Segment[];
  /** Outer diameter, in px. */
  size: number;
  /** Ring thickness, in px. */
  thickness?: number;
  /** Seconds before the first arc starts drawing. */
  delay?: number;
  /** Shown in the ring's hole, e.g. the total. */
  children?: ReactNode;
  /** Accessible summary of the whole chart. */
  label: string;
  className?: string;
};

const GAP_DEGREES = 2;
const DRAW_SECONDS = 1.1;

/** A point on the circle, angle in degrees clockwise from 12 o'clock. */
function polar(radius: number, degrees: number, center: number) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: center + radius * Math.cos(radians), y: center + radius * Math.sin(radians) };
}

function arcPath(radius: number, from: number, to: number, center: number) {
  // A full circle has the same start and end point, which SVG draws as nothing.
  const end = Math.min(to, from + 359.99);
  const start = polar(radius, from, center);
  const stop = polar(radius, end, center);
  const large = end - from > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${stop.x} ${stop.y}`;
}

/**
 * A ring split into proportional arcs that draw themselves in one after the
 * other, clockwise from the top, on mount (drawn at once under reduced
 * motion). For at-a-glance shares (damage by
 * type, ability casts); pair it with a legend, since arcs carry no text.
 */
function DonutChart({ segments, size, thickness = 18, delay = 0, children, label, className }: Props) {
  const reduceMotion = useReducedMotion();
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const visible = segments.filter((segment) => segment.value > 0);
  const gap = visible.length > 1 ? GAP_DEGREES : 0;
  const center = size / 2;
  const radius = (size - thickness) / 2;

  const sweeps = visible.map((segment) => (total > 0 ? (segment.value / total) * 360 : 0));
  const arcs = visible.map((segment, i) => {
    const start = sweeps.slice(0, i).reduce((sum, sweep) => sum + sweep, 0);
    const from = start + gap / 2;
    const to = start + sweeps[i] - gap / 2;
    const arcDelay = delay + (start / 360) * DRAW_SECONDS;
    return { ...segment, from, to: Math.max(from + 0.01, to), share: sweeps[i] / 360, arcDelay };
  });

  return (
    <div className={className} style={{ position: "relative", width: size, height: size }}>
      <svg role="img" aria-label={label} viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
        {arcs.map((arc) => (
          <motion.path
            key={arc.key}
            d={arcPath(radius, arc.from, arc.to, center)}
            fill="none"
            stroke={arc.color}
            strokeWidth={thickness}
            style={{ filter: `drop-shadow(0 0 6px ${arc.color}66)` }}
            initial={reduceMotion ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: Math.max(0.2, arc.share * DRAW_SECONDS), delay: arc.arcDelay, ease: "linear" }}
          />
        ))}
      </svg>
      {children ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
      ) : null}
    </div>
  );
}

export type { Segment as DonutSegment };
export { DonutChart };
