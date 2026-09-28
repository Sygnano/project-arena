"use client";

import type { HoverPoint } from "@/components/hextech-bar-chart";
import type { MultikillKey, PlateTier } from "@/features/recap/components/slides/kills/types";

function Plate({ tier, onHover }: { tier: PlateTier; onHover: (id: MultikillKey | null, point?: HoverPoint) => void }) {
  return (
    <div
      tabIndex={0}
      aria-label={`${tier.count} ${tier.label.toLowerCase()} kills`}
      onPointerEnter={(event) => onHover(tier.key, { x: event.clientX, y: event.clientY })}
      onPointerMove={(event) => onHover(tier.key, { x: event.clientX, y: event.clientY })}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") onHover(null);
      }}
      onFocus={(event) => {
        // Keyboard focus only; a click keeps the card on the pointer.
        if (!event.currentTarget.matches(":focus-visible")) return;
        const rect = event.currentTarget.getBoundingClientRect();
        onHover(tier.key, { x: rect.left + rect.width / 2, y: rect.top });
      }}
      onBlur={() => onHover(null)}
      className="flex flex-col items-center gap-5.5 rounded-sm outline-none transition-[filter] duration-150 hover:brightness-125 focus-visible:brightness-125"
    >
      <div
        className="relative flex h-31.5 w-31.5 rotate-45 items-center justify-center border"
        style={{
          borderColor: tier.borderColor,
          background: "rgba(5,14,22,.55)",
          boxShadow: tier.boxShadow,
        }}
      >
        {tier.prismatic ? <div className="tier-bar-prismatic absolute inset-1.25 opacity-[.16]" /> : null}
        <div className="font-display relative text-[42px] -rotate-45" style={{ color: tier.countColor }}>
          {tier.count}
        </div>
      </div>
      <div className="pl-[.28em] text-[11px] tracking-[.28em] mt-5" style={{ color: tier.labelColor }}>
        {tier.label}
      </div>
    </div>
  );
}

export { Plate };
