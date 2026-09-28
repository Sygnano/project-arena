import { cn } from "cn";
import { formatSignedPoints } from "./utils";

/**
 * A right-aligned "vs your average" table cell: cyan above zero, garnet
 * below, muted within ±1%. The sign glyph carries the direction too, so it
 * doesn't rely on color alone.
 */
function DeltaCell({ delta, className }: { delta: number; className?: string }) {
  const tone = Math.abs(delta) < 1 ? "text-lol-text-muted" : delta > 0 ? "text-[#0ae0cf]" : "text-lol-garnet";
  return (
    <div className={cn("text-right font-display text-[15px] tabular-nums", tone, className)}>
      {formatSignedPoints(delta, 0)}
    </div>
  );
}

export { DeltaCell };
export { formatSignedPoints } from "./utils";
