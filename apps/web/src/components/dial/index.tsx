"use client";

import { useRef, useState, useLayoutEffect } from "react";
import { cn } from "cn";
import { RingFrame } from "./components/ring-frame";
import {
  LABEL_MAX_WIDTH,
  MAX_LABEL_FONT_SIZE,
  MAX_VALUE_FONT_SIZE,
  MIN_LABEL_FONT_SIZE,
  MIN_VALUE_FONT_SIZE,
  VALUE_MAX_WIDTH,
} from "./constants";

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
function Dial({ value, label, formatValue, className, labelPosition = "bottom" }: Props) {
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
      <div className="pl-[.42em] tracking-[.42em] text-lol-blue-300" style={{ fontSize: labelFontSize }}>
        {label}
      </div>
    </div>
  );

  return (
    <RingFrame size={286} className={cn("mt-11", className)}>
      <div className="text-center">
        {labelPosition === "top" && <div className="mb-1.5">{labelEl}</div>}
        <div className="relative mx-auto text-center" style={{ width: VALUE_MAX_WIDTH }}>
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

export { Dial };
export { RingFrame } from "./components/ring-frame";
export { IdentityRing } from "./components/identity-ring";
