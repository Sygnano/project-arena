"use client";

import { AnimatedNumber } from "@/components/animated-number";
import { formatCompact } from "@/utils/format";

/** Reads a stat as a plain animated integer — the default for almost every
 * line below, so it's worth not repeating the `<AnimatedNumber>` call. */
function Num({ value, compact = false, suffix }: { value: number; compact?: boolean; suffix?: string }) {
  return (
    <AnimatedNumber
      value={value}
      durationMs={700}
      format={(v) => {
        const rounded = Math.round(v);
        const text = compact ? formatCompact(rounded) : rounded.toLocaleString("en-US");
        return suffix ? `${text}${suffix}` : text;
      }}
    />
  );
}

export { Num };
