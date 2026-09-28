"use client";

import { AnimatedNumber } from "@/components/animated-number";

/** One figure of the finale's season summary, counting up as it reveals. */
function SummaryStat({
  label,
  value,
  format,
  decimals,
  highlight = false,
}: {
  label: string;
  value: number;
  format?: (value: number) => string;
  decimals?: number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col-reverse items-center gap-2 px-3 py-1">
      <dt className="text-[11px] tracking-[.24em] whitespace-nowrap text-lol-text-muted">{label}</dt>
      <dd
        className="font-display text-[28px] leading-none sm:text-[32px]"
        style={{ color: highlight ? "var(--color-lol-gold-300)" : "var(--color-lol-gold-50)" }}
      >
        <AnimatedNumber value={value} format={format} decimals={decimals} />
      </dd>
    </div>
  );
}

export { SummaryStat };
