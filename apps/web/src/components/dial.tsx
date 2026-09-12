"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "cn";

/** The two known ring sizes in the design — 286px is the "standard" dial
 * (KDA, TimePlayed, Banned Champions), 262px is Champion Picks' identity
 * ring (sized down to leave room for the name block below it). Every other
 * number here (the hairline insets, the spinning arc's radius/dasharray)
 * is hand-tuned per size in the design rather than a clean scale of the
 * other, so both are stored verbatim instead of derived by formula. */
const RING_METRICS = {
  286: {
    outerInset: 32,
    innerInset: 20,
    r: 122,
    dashOuter: "144 622",
    dashInner: "38 728",
    dashInnerOffset: "-290",
  },
  262: {
    outerInset: 22,
    innerInset: 10,
    r: 112,
    dashOuter: "132 572",
    dashInner: "34 670",
    dashInnerOffset: "-266",
  },
} as const;

type RingSize = keyof typeof RING_METRICS;

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
      className={cn(
        "relative mx-auto flex items-center justify-center",
        className,
      )}
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
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="dial-spin absolute inset-0 h-full w-full"
      >
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

type Props = {
  /** The numeric value displayed in the center. */
  value: number;
  /** Label shown next to the value (see `labelPosition`). */
  label: string;
  /** Optional format function — defaults to `value.toFixed(2)`. */
  formatValue?: (value: number) => string;
  /** Additional classes on the outermost wrapper. */
  className?: string;
  /** `"bottom"` (default, every other dial) or `"top"` — Damage's "TOTAL
   * DMG" caption sits above its number instead of below. */
  labelPosition?: "top" | "bottom";
};

/** The value's font-size at its largest — the design's original size, never
 * scaled up past this. */
const MAX_VALUE_FONT_SIZE = 72;
/** Floor so an unusually long formatted value never shrinks to illegible. */
const MIN_VALUE_FONT_SIZE = 30;
/** Comfortable horizontal room for the value inside the 286px ring's inner
 * circle, with a little padding left over on every side — deliberately well
 * short of the 246px inner-circle diameter itself: the value's own text
 * height eats into the circle's usable chord width away from dead-center,
 * and the ring's hairline border needs daylight around the glyphs, not a
 * tangent touch. */
const VALUE_MAX_WIDTH = 168;

/**
 * A circular dial gauge — `RingFrame` plus a value + label centered inside.
 * Reusable across any section that needs this "hextech instrument" ring
 * showing off a single number (for a ring around something else, e.g. a
 * portrait, use `RingFrame` directly).
 *
 * The value auto-shrinks to fit `VALUE_MAX_WIDTH`: measured once per render
 * via an invisible same-font copy at `MAX_VALUE_FONT_SIZE` (text width scales
 * linearly with font-size for fixed content/font, so one measurement gives
 * the exact target size — no iterative search needed), then scaled down from
 * there if it would overflow. Runs in `useLayoutEffect` so the corrected size
 * commits before the browser paints, avoiding a flash of the wrong size.
 */
function Dial({
  value,
  label,
  formatValue,
  className,
  labelPosition = "bottom",
}: Props) {
  const text = formatValue ? formatValue(value) : value.toFixed(2);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(MAX_VALUE_FONT_SIZE);

  useLayoutEffect(() => {
    const naturalWidth = measureRef.current?.scrollWidth ?? 0;
    if (naturalWidth <= 0) return;
    const scale = Math.min(1, VALUE_MAX_WIDTH / naturalWidth);
    setFontSize(Math.max(MIN_VALUE_FONT_SIZE, MAX_VALUE_FONT_SIZE * scale));
  }, [text]);

  const labelEl = (
    <div className="pl-[.42em] text-sm tracking-[.42em] text-lol-blue-300">
      {label}
    </div>
  );

  return (
    <RingFrame size={286} className={cn("mt-11", className)}>
      <div className="text-center">
        {labelPosition === "top" && <div className="mb-1.5">{labelEl}</div>}
        <div
          className="relative mx-auto text-center"
          style={{ width: VALUE_MAX_WIDTH }}
        >
          <div
            ref={measureRef}
            aria-hidden
            className="invisible absolute top-0 left-1/2 -translate-x-1/2 font-display whitespace-nowrap"
            style={{ fontSize: MAX_VALUE_FONT_SIZE, lineHeight: 1 }}
          >
            {text}
          </div>
          <div
            className="font-display leading-none text-lol-gold-50"
            style={{ fontSize, textShadow: "0 0 26px rgba(10,200,185,.35)" }}
          >
            {text}
          </div>
        </div>
        {labelPosition === "bottom" && <div className="mt-1.5">{labelEl}</div>}
      </div>
    </RingFrame>
  );
}

export { Dial, RingFrame };
