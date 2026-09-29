"use client";

import { motion, useReducedMotion } from "motion/react";
import { tierGradient } from "@/utils/tier-bars";

type Props = {
  /** Games per hour of the viewer's day, index 0 = midnight. */
  gamesByHour: number[];
  /** The zone those hours are in ("UTC+2"). */
  zone: string;
  size?: number;
  delay?: number;
};

const INNER = 0.21;
const OUTER = 0.41;

const pad = (hour: number) => String(hour).padStart(2, "0");

/**
 * When the games happen, as a 24-hour clock: midnight at the top, one ray
 * per hour, its length and color (silver to gold to prismatic) by games
 * started then. The busiest hour sits in the middle. Rays grow in clockwise.
 */
function HourClock({ gamesByHour, zone, size = 250, delay = 0.9 }: Props) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(1, ...gamesByHour);
  const peak = gamesByHour.reduce((best, games, hour) => (games > gamesByHour[best] ? hour : best), 0);
  const center = size / 2;
  const at = (hour: number, radius: number) => {
    const angle = (hour / 24) * 2 * Math.PI - Math.PI / 2;
    return { x: center + radius * size * Math.cos(angle), y: center + radius * size * Math.sin(angle) };
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        overflow="visible"
        role="img"
        aria-label={`Games by hour of day, ${zone}; busiest ${pad(peak)}:00`}
      >
        <circle cx={center} cy={center} r={INNER * size - 5} fill="none" stroke="rgba(200,170,110,.25)" />
        {gamesByHour.map((games, hour) => {
          const from = at(hour, INNER);
          const to = at(hour, INNER + (OUTER - INNER) * (games / max));
          const color = tierGradient(games / max);
          return games > 0 ? (
            <motion.path
              key={hour}
              d={`M ${from.x} ${from.y} L ${to.x} ${to.y}`}
              stroke={color}
              strokeWidth={size / 34}
              strokeLinecap="round"
              style={{ filter: hour === peak ? `drop-shadow(0 0 6px ${color})` : undefined }}
              initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: delay + hour * 0.04, duration: 0.5, ease: "easeOut" }}
            />
          ) : null;
        })}
        {[0, 6, 12, 18].map((hour) => {
          const point = at(hour, OUTER + 0.06);
          return (
            <text
              key={hour}
              x={point.x}
              y={point.y + 4}
              textAnchor="middle"
              fontSize={size / 20}
              fill="var(--color-lol-text-muted)"
            >
              {pad(hour)}
            </text>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="font-display text-[clamp(18px,2vw,24px)] leading-none text-lol-gold-50">{pad(peak)}:00</span>
        <span className="mt-1 text-[8.5px] tracking-[.3em] text-lol-gold-300">PRIME TIME</span>
        <span className="mt-0.5 text-[8.5px] tracking-[.2em] text-lol-text-muted">{zone}</span>
      </div>
    </div>
  );
}

export { HourClock };
