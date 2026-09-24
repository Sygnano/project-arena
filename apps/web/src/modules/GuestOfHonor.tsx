"use client";

import { useMemo, type CSSProperties } from "react";
import { cn } from "cn";
import type { GuestOfHonorAugmentStats, GuestOfHonorChampionStats, GuestOfHonorStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { FadingRule } from "@/components/fading-rule";
import { AccordionGallery, type AccordionGalleryItem } from "@/components/accordion-gallery";
import { championIconUrl, championSplashUrl } from "@/lib/riot";
import { TIER_STYLE } from "@/lib/tier-bars";
import { isLowSample } from "@/lib/sample";
import { RING_WIDTH, augmentFrameClassName, tierForAugmentCard } from "@/components/augment-framed-card";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { useFitScale } from "@/hooks/use-fit-scale";

type Props = {
  guestOfHonor: GuestOfHonorStats;
};

function ChampionCrest({ championName }: { championName: string }) {
  return (
    <img
      loading="lazy"
      decoding="async"
      src={championIconUrl(iconName(championName))}
      alt=""
      width={40}
      height={40}
      style={
        {
          "--augment-frame-fill": "var(--color-lol-navy-900)",
          "--augment-frame-width": RING_WIDTH.gold,
        } as CSSProperties
      }
      className="aspect-square w-10 flex-none rounded-full object-cover augment-frame augment-frame-gold"
    />
  );
}

/** `championIconUrl`/`championSplashUrl` expect Data Dragon's no-space
 * PascalCase champion id (e.g. "TahmKench"), not the space-separated display
 * name this screen otherwise shows — every other Guest of Honor champion
 * (Vayne, Kindred, Yone) is a single word already, so only Tahm Kench
 * actually needs this. */
function iconName(championName: string): string {
  return championName.replace(/\s+/g, "");
}

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

/** A champion's augment set inside an expanded accordion panel: the same
 * compact card for every champion, whatever the size of their set, scaled down
 * as a whole until it fits the panel (no inner scrollbar). Wrapping alone
 * isn't enough: a 3x3 grid is too tall for a short deck-mode panel at any column count, and squeezing the cards' own
 * type sizes per row count would mean re-tuning them against one screen. */
function ChampionAugments({ champion }: { champion: GuestOfHonorChampionStats }) {
  const { outerRef, innerRef, scale } = useFitScale<HTMLDivElement, HTMLDivElement>();

  return (
    <div
      ref={outerRef}
      className="flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-7 pt-4 pb-7"
    >
      <div
        ref={innerRef}
        className="flex w-full flex-col gap-3"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        {champion.rows.map((row) => (
          <div
            key={row.key}
            // Compact cards wrap instead of scrolling sideways, so a long
            // single-row set (Vayne's 7) folds into readable rows.
            className="flex flex-none flex-wrap items-stretch justify-center gap-3"
          >
            {row.augments.map((augment) => (
              <CompactAugmentCard key={augment.augmentId} augment={augment} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A handful of champions (Tahm Kench, Vayne, Kindred, Yone) grant a teammate
 * a champion-exclusive augment line instead of a normal draft pick — Riot's
 * own "Guest of Honor" mechanic (see `apps/api/src/leagueData/augments/augmentGroups.ts`'s
 * `GUEST_OF_HONOR_CHAMPIONS`). These augments are excluded from the normal
 * catalog/picks panels (`AugmentHallOfFame`/`AugmentPicks`) since they're not
 * part of the normal offer pool, so they get their own full-size panel right
 * after Augment God.
 *
 * Presented as an accordion gallery (`components/accordion-gallery.tsx`)
 * rather than the carousel this used to be: every champion stays on screen as
 * its own panel of splash art, and hovering one opens it. A carousel showed
 * exactly one champion and hid the rest behind a timer, which for a set this
 * small (four champions) meant waiting to see something that could simply
 * have been visible.
 */
const GuestOfHonor = ({ guestOfHonor }: Props) => {
  const champions = guestOfHonor.champions;

  const items = useMemo<AccordionGalleryItem[]>(
    () =>
      champions.map((champion) => ({
        key: champion.championId,
        imageUrl: championSplashUrl(iconName(champion.championName)),
        label: champion.championName.toUpperCase(),
        badge: <ChampionCrest championName={champion.championName} />,
        content: <ChampionAugments champion={champion} />,
      })),
    [champions],
  );

  return (
    <CategorySection
      imageUrl={SECTION_BACKGROUNDS.guestOfHonor}
      title="GUESTS OF HONOR"
      quote="What can they do to me that they have not done?"
    >
      <HextechPanel bodyClassName="p-8">
        <div className="mb-4 flex flex-none flex-wrap items-center gap-x-6 gap-y-3">
          <div className="text-[11px] tracking-[.28em] text-lol-gold-300">{champions.length} CHAMPIONS</div>
          <FadingRule />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted sm:whitespace-nowrap">
            SELECT A CHAMPION TO OPEN THEIR LINE
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          {champions.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-lol-text-muted">
              No tracked matches yet.
            </div>
          ) : (
            <AccordionGallery
              ariaLabel="Guest of Honor champions"
              items={items}
              trigger="click"
              // Champion splash art puts the character's face above the
              // middle of the frame, so a centred crop of a wide panel tends
              // to cut it; bias the crop upward.
              imagePosition="50% 30%"
            />
          )}
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { GuestOfHonor };
