"use client";

import type { ItemOutcomeStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { ItemMedallion } from "@/components/item-medallion";
import { RatePair } from "@/components/rate-pair";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Baseline = { top3Rate: number; top1Rate: number };

type Props = {
  specialItems: ItemOutcomeStats[];
  baseline: Baseline;
};

const CARD_CORNERS = [
  "-top-1.25 -left-1.25",
  "-top-1.25 -right-1.25",
  "-bottom-1.25 -left-1.25",
  "-bottom-1.25 -right-1.25",
] as const;

// Each card gets its own flavour line above the name, in the slot the
// "The" of "The Golden Spatula" used to occupy — matched on the item's real
// name so an item we have no line for simply renders without one.
const EYEBROWS: { match: RegExp; text: string }[] = [
  { match: /golden spatula/i, text: "Must. Do. Everything." },
  { match: /wooglet/i, text: "lol thanks Riot. You made it!" },
  { match: /void immolation/i, text: "Icathia's fall" },
];

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

/**
 * Special Items — Arena's granted upgrade items (The Golden Spatula,
 * Wooglet's Witchcap, Void Immolation) as three equal reliquary cards, full
 * width with no identity column: how many matches the summoner ended holding
 * each, and how those matches finished.
 */
const SpecialItems = ({ specialItems, baseline }: Props) => {
  return (
    <CategorySection
      title="SPECIAL ITEMS"
      quote="I got two guns. One's for what's in front of me, and one's for what's chasin'."
      imageUrl={SECTION_BACKGROUNDS.specialItems}
    >
      {/* The inner scroller is a phone-only fallback (three full-height cards
        stacked in one column). From `md` up the cards sit side by side and
        size themselves to the slide, so the section fits one screen with no
        scrollbar of its own. */}
      <div className="grid min-h-0 grid-cols-1 gap-8 overflow-y-auto pt-4 md:grid-cols-3 md:gap-12 md:overflow-visible">
        {specialItems.map((item) => (
          <ItemCard key={item.itemId} item={item} baseline={baseline} />
        ))}
      </div>
    </CategorySection>
  );
};

export { SpecialItems };
