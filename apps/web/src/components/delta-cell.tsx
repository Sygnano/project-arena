import { cn } from "cn";

/** A difference between two rates, as a plain subtraction ("+4.2%"): 55% vs
 * 50% is +5%, not +10%. Shown with "%" rather than "pp", which few readers know. */
export function formatSignedPoints(delta: number, digits = 1): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta).toFixed(digits)}%`;
}

/**
 * A right-aligned "vs your average" table cell: cyan above zero, garnet
 * below, muted within ±1%. The sign glyph carries the direction too, so it
 * doesn't rely on color alone.
 */
export function DeltaCell({ delta, className }: { delta: number; className?: string }) {
  const tone =
    Math.abs(delta) < 1
      ? "text-lol-text-muted"
      : delta > 0
        ? "text-[#0ae0cf]"
        : "text-lol-garnet";
  return (
    <div className={cn("text-right font-display text-[15px] tabular-nums", tone, className)}>
      {formatSignedPoints(delta, 0)}
    </div>
  );
}
