import { cn } from "cn";
import { isLowSample } from "@/features/recap/utils/sample";
import { SIZES } from "@/features/recap/components/rate-pair/constants";
import type { Rate } from "@/features/recap/components/rate-pair/types";
import { RateDelta } from "./components/rate-delta";

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
      <div className={cn("mt-2 pl-[.24em] tracking-[.24em] whitespace-nowrap text-lol-text-muted", SIZES[size].label)}>
        {rate.label}
      </div>
      {rate.baseline !== undefined && rate.value != null ? (
        <RateDelta
          delta={rate.value - rate.baseline}
          lowSample={rate.sample !== undefined && isLowSample(rate.sample)}
        />
      ) : null}
    </div>
  );
}

export { RateCell };
