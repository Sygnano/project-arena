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
        "dial-fit relative mx-auto flex flex-none items-center justify-center",
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

/** Reference outer size (px) the Welcome card's medallion (`h-57 w-57`,
 * `apps/web/src/modules/Welcome.tsx`) was hand-tuned at — `IdentityRing`
 * scales every inset/marker metric proportionally from this baseline rather
 * than re-tuning them per instance. */
const IDENTITY_RING_REFERENCE_SIZE = 228;

type IdentityRingProps = {
  /** Outer diameter in px. Defaults to the Welcome card's own size. */
  size?: number;
  /** The portrait/avatar element centered inside the ring. */
  children: ReactNode;
  /** Content anchored to the ring's bottom edge in the same rotated-diamond
   * chrome as Welcome's summoner-level badge — omit for rings with no
   * badge. */
  badge?: ReactNode;
  className?: string;
};

/**
 * The Welcome card's "identity medallion" chrome — a slow dashed spin ring,
 * a reverse-spinning diamond frame with two breathing gold markers, and a
 * static rotated-diamond backing plate — extracted from `Welcome.tsx` once
 * Guest of Honor needed the same dial around a champion portrait instead of
 * a summoner's profile icon. Every metric (insets, marker sizes/offsets)
 * scales proportionally from the Welcome card's own 228px baseline via a
 * single `scale` ratio, so a smaller `size` reproduces the exact same
 * chrome rather than needing hand-tuned constants per size — unlike
 * `RingFrame` below, whose two sizes ARE hand-tuned per-size (its
 * double-arc SVG dash patterns don't scale cleanly by a flat ratio).
 */
function IdentityRing({
  size = IDENTITY_RING_REFERENCE_SIZE,
  children,
  badge,
  className,
}: IdentityRingProps) {
  const scale = size / IDENTITY_RING_REFERENCE_SIZE;
  const markerSize = 8 * scale;
  const markerOffset = -4 * scale;

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
      <div
        className="welcome-spin-reverse absolute"
        style={{ inset: 20 * scale }}
      >
        <div className="absolute inset-0 rotate-45 border border-[rgba(200,170,110,.45)]" />
        <div
          className="absolute left-1/2 -translate-x-1/2 rotate-45 bg-lol-gold-300"
          style={{ top: markerOffset, height: markerSize, width: markerSize }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rotate-45 bg-lol-gold-300"
          style={{
            bottom: markerOffset,
            height: markerSize,
            width: markerSize,
          }}
        />
      </div>
      <div
        className="absolute rotate-45 border border-[rgba(200,170,110,.7)] bg-[rgba(4,12,20,.6)]"
        style={{
          inset: 38 * scale,
          boxShadow: "0 0 70px rgba(200,170,110,.16)",
        }}
      />
      <div
        className="welcome-breathe-glow absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 90px rgba(10,200,185,.1) inset" }}
      />
      {children}
      {badge}
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

/** The label's font-size at its largest — matches the original fixed
 * `text-sm`, never scaled up past this. */
const MAX_LABEL_FONT_SIZE = 14;
/** Floor so an unusually long label never shrinks to illegible. */
const MIN_LABEL_FONT_SIZE = 9;
/** Comfortable horizontal room for the label, same reasoning as
 * `VALUE_MAX_WIDTH` — a short label (e.g. "TOTAL DMG") never approaches this
 * and stays at `MAX_LABEL_FONT_SIZE`; a long one (e.g. "SAVES FROM DEATH")
 * shrinks to fit rather than overflowing the ring's own hairline border. */
const LABEL_MAX_WIDTH = 190;

/**
 * A circular dial gauge — `RingFrame` plus a value + label centered inside.
 * Reusable across any section that needs this "hextech instrument" ring
 * showing off a single number (for a ring around something else, e.g. a
 * portrait, use `RingFrame` directly).
 *
 * The value auto-shrinks to fit `VALUE_MAX_WIDTH`, and the label auto-shrinks
 * to fit `LABEL_MAX_WIDTH` the same way — both measured once per render via
 * an invisible same-font copy at their max font size (text width scales
 * linearly with font-size for fixed content/font, so one measurement gives
 * the exact target size — no iterative search needed), then scaled down from
 * there if it would overflow. Runs in `useLayoutEffect` so the corrected size
 * commits before the browser paints, avoiding a flash of the wrong size. The
 * label needs this independently of the value: a long label like "SAVES FROM
 * DEATH" combined with the design's own extreme `.42em` letter-spacing can
 * run wider than the ring's hairline border, which a short label (e.g.
 * "TOTAL DMG") never approaches — that one stays at `MAX_LABEL_FONT_SIZE`.
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

  const measureLabelRef = useRef<HTMLDivElement>(null);
  const [labelFontSize, setLabelFontSize] = useState(MAX_LABEL_FONT_SIZE);

  useLayoutEffect(() => {
    const naturalWidth = measureLabelRef.current?.scrollWidth ?? 0;
    if (naturalWidth <= 0) return;
    const scale = Math.min(1, LABEL_MAX_WIDTH / naturalWidth);
    setLabelFontSize(Math.max(MIN_LABEL_FONT_SIZE, MAX_LABEL_FONT_SIZE * scale));
  }, [label]);

  const labelEl = (
    <div className="relative mx-auto text-center" style={{ width: LABEL_MAX_WIDTH }}>
      <div
        ref={measureLabelRef}
        aria-hidden
        className="invisible absolute top-0 left-1/2 -translate-x-1/2 pl-[.42em] tracking-[.42em] whitespace-nowrap"
        style={{ fontSize: MAX_LABEL_FONT_SIZE }}
      >
        {label}
      </div>
      <div
        className="pl-[.42em] tracking-[.42em] text-lol-blue-300"
        style={{ fontSize: labelFontSize }}
      >
        {label}
      </div>
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

export { Dial, RingFrame, IdentityRing };
