"use client";

import type { ReactNode } from "react";
import { cn } from "cn";
import { RING_METRICS } from "./constants";
import type { RingSize } from "./types";

type RingFrameProps = {
  /** Outer diameter in px — see `RING_METRICS`. */
  size?: RingSize;
  children: ReactNode;
  className?: string;
};

/**
 * The Hextech "instrument ring" chrome — two hairline circles, a spinning
 * double-arc SVG, and two breathing gold diamonds top/bottom — with no
 * opinion on what sits in the center. Extracted from `Dial` (which adds a
 * centered value/label) once Champion Picks needed the identical ring
 * wrapped around a champion portrait instead of a number.
 */
function RingFrame({ size = 286, children, className }: RingFrameProps) {
  const metrics = RING_METRICS[size];
  return (
    <div
      className={cn("dial-fit relative mx-auto flex flex-none items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <div
        className="absolute rounded-full border border-[rgba(200,170,110,.55)]"
        style={{ inset: metrics.outerInset }}
      />
      <div
        className="absolute rounded-full border border-[rgba(10,200,185,.16)]"
        style={{ inset: metrics.innerInset }}
      />
      <svg viewBox={`0 0 ${size} ${size}`} className="dial-spin absolute inset-0 h-full w-full">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={metrics.r}
          fill="none"
          stroke="var(--color-lol-blue-400)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={metrics.dashOuter}
          opacity=".9"
          style={{ filter: "drop-shadow(0 0 8px rgba(10,196,217,.9))" }}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={metrics.r}
          fill="none"
          stroke="var(--color-lol-blue-300)"
          strokeWidth="1"
          strokeDasharray={metrics.dashInner}
          strokeDashoffset={metrics.dashInnerOffset}
          opacity=".5"
        />
      </svg>
      <div className="dial-breathe absolute top-[-2px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-lol-gold-300" />
      <div
        className="dial-breathe absolute bottom-[-2px] left-1/2 h-3 w-3 -translate-x-1/2 rotate-45 bg-lol-gold-300"
        style={{ animationDelay: "2.5s" }}
      />
      {children}
    </div>
  );
}

export { RingFrame };
