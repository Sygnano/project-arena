import { cn } from "cn";
import { formatSignedPoints } from "@/components/delta-cell";
import { isLowSample } from "@/lib/sample";

type Rate = {
  label: string;
  /** 0-100, or null when there's no sample to compute it from. */
  value: number | null;
  highlight?: boolean;
  /** The summoner's own rate over all games (0-100). When given, a signed
   * "vs average" difference (in %) is shown under the label. */
  baseline?: number;
  /** Games behind `value`; under `MIN_SAMPLE` the difference is withheld.
   * Omit it to always show the difference. */
  sample?: number;
};

type Props = {
  left: Rate;
  right: Rate;
  /** `"lg"` for a hero readout, `"md"` for a card footer. */
  size?: "lg" | "md";
  className?: string;
};

const SIZES = {
  lg: { value: "text-[40px]", label: "text-[11px]", gap: "gap-10", rule: "h-14" },
  md: { value: "text-[30px]", label: "text-[11px]", gap: "gap-7", rule: "h-11" },
} as const;

function RateDelta({ delta, lowSample }: { delta: number; lowSample: boolean }) {
  const tone = lowSample || Math.abs(delta) < 1
    ? "text-lol-text-muted"
    : delta > 0
      ? "text-[#0ae0cf]"
      : "text-lol-garnet";
  return (
    <div className={cn("mt-1 text-[11px] tracking-[.12em] tabular-nums", tone)}>
      {lowSample ? "FEW GAMES" : `${formatSignedPoints(delta, 0)} VS AVG`}
    </div>
  );
}

function RateCell({ rate, size }: { rate: Rate; size: "lg" | "md" }) {
  return (
    <div className="flex min-w-[110px] flex-col items-center">
      <div
        className={cn(
          "font-display leading-none tabular-nums",
          SIZES[size].value,
          rate.highlight ? "text-lol-gold-300" : "text-lol-gold-50",
        )}
      >
        {rate.value == null ? "—" : `${rate.value.toFixed(0)}%`}
      </div>
      <div
        className={cn(
          "mt-2 pl-[.24em] tracking-[.24em] whitespace-nowrap text-lol-text-muted",
          SIZES[size].label,
        )}
      >
        {rate.label}
      </div>
      {rate.baseline !== undefined && rate.value != null ? (
        <RateDelta delta={rate.value - rate.baseline} 
          lowSample={rate.sample !== undefined && isLowSample(rate.sample)}
        />
      ) : null}
    </div>
  );
}

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
            background:
              "linear-gradient(180deg, transparent, rgba(200,170,110,.55), transparent)",
          }}
        />
        <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-lol-gold-300" />
      </div>
      <RateCell rate={right} size={size} />
    </div>
  );
}

export { RatePair };
