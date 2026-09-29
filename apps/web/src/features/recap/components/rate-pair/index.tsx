import { cn } from "cn";
import { RateCell } from "./components/rate-cell";
import { SIZES } from "./constants";
import type { Rate } from "./types";

type Props = {
  left: Rate;
  right: Rate;
  /** `"lg"` for a hero readout, `"md"` for a card footer. */
  size?: "lg" | "md";
  className?: string;
};

/** Two percentages side by side, split by a gold hairline with a diamond —
 * e.g. WIN RATE | TOP 1 RATE under a featured item. */
function RatePair({ left, right, size = "lg", className }: Props) {
  return (
    <div className={cn("flex items-center justify-center", SIZES[size].gap, className)}>
      <RateCell rate={left} size={size} />
      <div className={cn("relative w-px", SIZES[size].rule)}>
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, transparent, rgba(200,170,110,.55), transparent)",
          }}
        />
        <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-lol-gold-300" />
      </div>
      <RateCell rate={right} size={size} />
    </div>
  );
}

export { RatePair };
