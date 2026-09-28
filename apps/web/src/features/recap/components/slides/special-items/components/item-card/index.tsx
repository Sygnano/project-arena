"use client";

import type { ItemOutcomeStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { ItemMedallion } from "@/features/recap/components/item-medallion";
import { RatePair } from "@/features/recap/components/rate-pair";
import type { Baseline } from "@/features/recap/components/slides/special-items/types";
import { CARD_CORNERS, EYEBROWS } from "./constants";

function ItemCard({ item, baseline }: { item: ItemOutcomeStats; baseline: Baseline }) {
  const eyebrow = EYEBROWS.find((e) => e.match.test(item.itemName))?.text ?? null;
  const name = item.itemName.replace(/^The\s+/i, "");
  const rate = (count: number) => (item.timesPicked > 0 ? (count / item.timesPicked) * 100 : null);

  return (
    <div className="relative min-h-0 min-w-0">
      {/* Frame: dark fill with the item's own art blown up and blurred
        behind it, so each card carries that item's colour. */}
      <div
        className="absolute inset-0 overflow-hidden border"
        style={{
          borderColor: "rgba(200,170,110,.55)",
          background: "linear-gradient(180deg, rgba(9,20,40,.72), rgba(3,10,18,.88))",
          boxShadow: "0 0 50px rgba(200,170,110,.08)",
        }}
      >
        <img
          loading="lazy"
          decoding="async"
          src={item.iconUrl}
          alt=""
          className="absolute top-[-8%] left-1/2 w-[130%] max-w-none -translate-x-1/2 opacity-[.26] blur-[42px] saturate-150"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(3,10,18,.35)] to-[rgba(3,10,18,.95)]" />
      </div>
      {CARD_CORNERS.map((pos) => (
        <div
          key={pos}
          className={`absolute h-2.5 w-2.5 rotate-45 border bg-[#040c14] ${pos}`}
          style={{ borderColor: "rgba(200,170,110,.8)" }}
        />
      ))}

      <div className="relative flex h-full flex-col items-center px-8 pt-[clamp(18px,3.2vh,32px)] pb-[clamp(16px,2.8vh,28px)] text-center">
        <div
          aria-hidden={!eyebrow}
          className="font-display text-[13px] tracking-[.18em] text-lol-gold-300"
          style={{ visibility: eyebrow ? "visible" : "hidden" }}
        >
          {eyebrow ?? " "}
        </div>
        <div className="font-display mt-1 text-[clamp(20px,2.6vh,26px)] leading-tight tracking-[.16em] text-lol-gold-50 uppercase">
          {name}
        </div>
        <div className="mt-[clamp(8px,1.4vh,14px)] flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-[rgba(200,170,110,.6)]" />
          <div className="h-1.5 w-1.5 rotate-45 bg-lol-gold-300" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-[rgba(200,170,110,.6)]" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col items-center justify-center">
          <ItemMedallion
            iconUrl={item.iconUrl}
            alt={item.itemName}
            // Viewport-fluid rather than a fixed 190px (and rather than
            // `dial-fit`'s single zoom step): the medallion and the count
            // below it are what make this card outgrow a short slide, so they
            // shrink with the viewport instead of pushing the footer out of
            // the section and turning the grid into a scroller.
            size="clamp(118px, 19vh, 190px)"
            glow={0.34}
          />
          <AnimatedNumber
            value={item.timesPicked}
            className="font-display mt-[clamp(10px,1.6vh,16px)] text-[clamp(40px,6vh,60px)] leading-none text-lol-gold-50 [text-shadow:0_0_30px_rgba(200,170,110,.35)]"
          />
          <div className="mt-2 pl-[.24em] text-[11px] tracking-[.24em] text-lol-text-muted">OBTAINED</div>
        </div>

        <RatePair
          size="md"
          left={{
            label: "WINRATE",
            value: rate(item.top3),
            baseline: baseline.top3Rate,
          }}
          right={{
            label: "1ST RATE",
            value: rate(item.top1),
            highlight: true,
            baseline: baseline.top1Rate,
          }}
        />
      </div>
    </div>
  );
}

export { ItemCard };
