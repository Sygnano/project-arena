"use client";

import { AnimatedNumber } from "@/components/animated-number";

/** Renders a single count with a unit suffix, e.g. "5 days" or "12 games". */
function CountStat({ value, unit }: { value: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-self-end gap-1">
      <AnimatedNumber value={value} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{unit}</span>
    </div>
  );
}

export { CountStat };
