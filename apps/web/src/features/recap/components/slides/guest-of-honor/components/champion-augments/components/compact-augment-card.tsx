"use client";

import type { GuestOfHonorAugmentStats } from "@arena/types";
import { cn } from "cn";
import type { CSSProperties } from "react";
import { augmentFrameClassName, RING_WIDTH, tierForAugmentCard } from "@/features/recap/components/augment-framed-card";
import { isLowSample } from "@/features/recap/utils/sample";
import { TIER_STYLE } from "@/utils/tier-bars";

function CompactAugmentCard({ augment }: { augment: GuestOfHonorAugmentStats }) {
  const tier = tierForAugmentCard(augment);
  const tierStyle = tier ? TIER_STYLE[tier] : null;
  const picked = augment.timesPicked;
  const top3 = augment.top1 + augment.top3ExclTop1;
  const top3Rate = picked === 0 ? 0 : (top3 / picked) * 100;
  const lowSample = isLowSample(picked);

  return (
    // A solid, blurred card rather than bare text over the splash art: the
    // accordion panel's background is a full champion splash, and loose
    // figures on top of it collided with the art (and with each other once
    // a name wrapped to two lines).
    <div
      className={cn(
        "flex w-58 flex-none flex-col gap-2.5 rounded-md border bg-[rgba(1,10,19,.84)] p-3 shadow-[0_6px_24px_rgba(0,0,0,.45)] backdrop-blur-md",
        picked === 0 ? "border-[rgba(126,138,150,.18)] opacity-60" : "border-[rgba(200,170,110,.28)]",
      )}
    >
      <div className="flex items-center gap-3">
        <img
          loading="lazy"
          decoding="async"
          src={augment.iconUrl}
          alt=""
          width={44}
          height={44}
          style={
            {
              "--augment-frame-fill": "var(--color-lol-navy-900)",
              "--augment-frame-width": tier ? RING_WIDTH[tier] : "1px",
              borderColor: tier ? undefined : "rgba(126,138,150,.3)",
              boxShadow: tierStyle?.glow,
              filter: tier ? undefined : "grayscale(1) brightness(.7)",
            } as CSSProperties
          }
          className={cn("aspect-square w-11 flex-none rounded-full object-cover", augmentFrameClassName(tier))}
        />
        <div className="min-w-0 font-display text-[14px] leading-tight tracking-[.04em] text-lol-gold-50">
          {augment.augmentName}
        </div>
      </div>

      <div className="h-px bg-[linear-gradient(to_right,rgba(200,170,110,0),rgba(200,170,110,.35),rgba(200,170,110,0))]" />

      {picked === 0 ? (
        <div className="py-2 text-center text-[11px] tracking-[.2em] text-lol-text-muted">NEVER PICKED</div>
      ) : (
        <>
          <div className="grid grid-cols-3 divide-x divide-[rgba(200,170,110,.2)] text-center">
            {[
              { label: "PICKED", value: picked },
              { label: "WINS", value: top3 },
              { label: "1ST", value: augment.top1 },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col items-center">
                <span className="font-display text-[20px] leading-none text-lol-gold-50 tabular-nums">
                  {stat.value}
                </span>
                <span className="mt-1 text-[10px] tracking-[.14em] text-lol-text-muted">{stat.label}</span>
              </div>
            ))}
          </div>
          <div className={cn("flex flex-col gap-1", lowSample && "opacity-60")}>
            <div className="flex items-baseline justify-between text-[10px] tracking-[.14em] text-lol-text-muted">
              <span>WINRATE</span>
              <span className="font-display text-[12px] text-lol-gold-100 tabular-nums">{Math.round(top3Rate)}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-[rgba(200,170,110,.12)]">
              <div className={cn("h-full rounded-full", tierStyle?.fillClass)} style={{ width: `${top3Rate}%` }} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export { CompactAugmentCard };
