"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatCompact } from "@/utils/format";

type Line = { key: string; label: string; values: number[]; color: string };

type Props = {
  lines: Line[];
  delay?: number;
};

const WIDTH = 480;
const HEIGHT = 240;
const PAD = { top: 16, right: 76, bottom: 28, left: 4 };

/** Cumulative damage over a game's minutes, one line per curve, drawn left
 * to right, each labelled at its end. */
function DamageLines({ lines, delay = 1 }: Props) {
  const reduceMotion = useReducedMotion();
  const minutes = Math.max(2, ...lines.map((line) => line.values.length));
  const max = Math.max(1, ...lines.flatMap((line) => line.values));
  const x = (minute: number) => PAD.left + (minute / (minutes - 1)) * (WIDTH - PAD.left - PAD.right);
  const y = (value: number) => PAD.top + (1 - value / max) * (HEIGHT - PAD.top - PAD.bottom);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-auto w-full overflow-visible"
      role="img"
      aria-label={lines.map((line) => `${line.label}: ${formatCompact(line.values.at(-1) ?? 0)}`).join(", ")}
    >
      <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} stroke="rgba(200,170,110,.3)" />
      <text x={PAD.left} y={HEIGHT - 4} fill="var(--color-lol-text-muted)" fontSize={14} letterSpacing=".2em">
        0 MIN
      </text>
      <text
        x={WIDTH - PAD.right}
        y={HEIGHT - 4}
        textAnchor="end"
        fill="var(--color-lol-text-muted)"
        fontSize={14}
        letterSpacing=".2em"
      >
        {minutes - 1} MIN
      </text>
      {lines.map((line, i) => {
        const points = line.values.map((value, minute) => `${x(minute)},${y(value)}`).join(" L ");
        const last = line.values.length - 1;
        return (
          <g key={line.key}>
            <motion.path
              d={`M ${points}`}
              fill="none"
              stroke={line.color}
              strokeWidth={3}
              strokeLinejoin="round"
              style={{ filter: `drop-shadow(0 0 6px ${line.color}88)` }}
              initial={reduceMotion ? false : { pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: delay + i * 0.3, duration: 1.6, ease: "easeInOut" }}
            />
            <motion.text
              x={x(last) + 8}
              y={y(line.values[last] ?? 0) + 4}
              fill={line.color}
              fontSize={17}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: delay + i * 0.3 + 1.5 }}
            >
              {formatCompact(line.values[last] ?? 0)}
            </motion.text>
          </g>
        );
      })}
    </svg>
  );
}

export { DamageLines };
