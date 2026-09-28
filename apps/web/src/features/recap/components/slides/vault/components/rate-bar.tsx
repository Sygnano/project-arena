"use client";

/** A thin 0-100% rate bar with a tick at the summoner's own overall rate,
 * plus the number. */
function RateBar({ value, baseline, color }: { value: number; baseline: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1.5 flex-1" style={{ background: "rgba(240,230,210,.06)" }}>
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-300"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-px"
          style={{ left: `${baseline}%`, background: "rgba(240,230,210,.55)" }}
        />
      </div>
      <div
        className="w-11 flex-none text-right font-display text-[16px]"
        style={{
          color: value >= baseline ? "var(--color-lol-gold-50)" : "var(--color-lol-text-muted)",
        }}
      >
        {value.toFixed(0)}%
      </div>
    </div>
  );
}

export { RateBar };
