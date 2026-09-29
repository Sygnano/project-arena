"use client";

import { AnimatedNumber } from "@/components/animated-number";

/** Renders a two-part duration like "3h 27m" or "18m 42s". */
function DurationStat({
  major,
  majorUnit,
  minor,
  minorUnit,
}: {
  major: number;
  majorUnit: string;
  minor: number;
  minorUnit: string;
}) {
  return (
    <div className="flex items-baseline justify-self-end gap-1">
      <AnimatedNumber value={major} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{majorUnit}</span>
      <AnimatedNumber value={minor} className="font-display text-2xl font-semibold text-lol-gold-50" />
      <span className="font-display text-sm text-lol-text-muted">{minorUnit}</span>
    </div>
  );
}

export { DurationStat };
