"use client";

import type { PlacementStats } from "@arena/types";
import Link from "next/link";
import { Heart } from "lucide-react";
import { AnimatedNumber } from "@/components/animated-number";
import { IdentityRing } from "@/components/dial";
import { HeroSection } from "@/components/hero-section";
import { scrollToSlide } from "@/lib/slides";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  totalFistBumps: number;
  placements: PlacementStats;
  matchesPlayed: number;
};

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

const formatPercent = (value: number) => `${Math.round(value)}%`;

/**
 * The summoner page's closing screen, split in two: one held stat (post-game
 * fist bumps) on the left, the sign-off on the right (stacked on narrow
 * screens), bookending `Welcome`. The sign-off carries the season summary —
 * games, average place, winrate and 1st rate — held back from the title card
 * so the headline results land as the finale. Absorbs the former standalone
 * "Thank You" screen (a second ending with no content), and ends with a way
 * back into the page instead of a dead end.
 */
const Farewell = ({ totalFistBumps, placements, matchesPlayed }: Props) => {
  const rate = (count: number) => (matchesPlayed > 0 ? (count / matchesPlayed) * 100 : 0);

  return (
    <HeroSection imageUrl={SECTION_BACKGROUNDS.farewell} labelledBy="farewell-title">
      <div className="grid w-full max-w-6xl items-center gap-12 md:grid-cols-[1fr_auto_1fr] md:gap-16">
        {/* The held stat. */}
        <div className="flex flex-col items-center text-center">
          <IdentityRing size={228} className="scale-75 sm:scale-100">
            <img
              loading="lazy"
              decoding="async"
              src="/images/fistbump.jpg"
              alt=""
              width={104}
              height={104}
              style={{ filter: "brightness(1.35) contrast(1.08) saturate(1.1)" }}
              className="size-26 rounded-full border border-[rgba(200,170,110,.5)] object-cover"
            />
          </IdentityRing>

          <div className="mt-8 text-[11px] tracking-[.42em] text-lol-gold-300 sm:mt-13">FIST BUMPS GIVEN</div>

          <div className="mt-4" style={{ textShadow: "0 0 48px rgba(200,170,110,.22)" }}>
            <AnimatedNumber
              value={totalFistBumps}
              className="font-display text-[clamp(72px,16vw,140px)] leading-none tracking-[.05em] text-lol-gold-50"
            />
          </div>
        </div>

        <SplitRule />

        {/* The sign-off. */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left">
          <div className="text-[11px] tracking-[.42em] text-lol-gold-300">THANKS FOR PLAYING</div>

          <h2
            id="farewell-title"
            className="mt-5 font-display text-[clamp(36px,5.5vw,64px)] leading-[1.05] tracking-[.08em] text-lol-gold-50"
          >
            GG, WELL PLAYED
          </h2>

          <div className="mt-7 w-full max-w-[520px]">
            <div className="text-[11px] tracking-[.3em] text-lol-text-muted">YOUR SEASON</div>
            <dl className="mt-3 grid grid-cols-2 gap-y-4 border border-[rgba(200,170,110,.3)] bg-[rgba(4,12,20,.55)] py-4 xl:grid-cols-4 xl:divide-x xl:divide-[rgba(200,170,110,.18)]">
              <SummaryStat label="GAMES" value={matchesPlayed} />
              <SummaryStat label="AVG PLACE" value={placements.avgPlacement} decimals={2} highlight />
              <SummaryStat label="WINRATE" value={rate(placements.top3Finishes)} format={formatPercent} />
              <SummaryStat label="1ST RATE" value={rate(placements.top1Finishes)} format={formatPercent} />
            </dl>
          </div>

          <p className="mt-6 max-w-sm text-[15px] leading-relaxed text-lol-text-secondary">
            That&apos;s every round, every augment and every fist bump. See you back on the Rings of Wrath.
          </p>

          <p className="mt-6 flex items-center gap-2 text-[11px] tracking-[.32em] text-lol-gold-100">
            MADE WITH
            <Heart aria-label="love" className="size-3.5 fill-[rgba(232,64,87,.85)] stroke-[rgba(255,140,150,.9)]" />
            BY SYGNANO
          </p>

          <div className="mt-9 flex flex-wrap justify-center gap-3 md:justify-start">
            <button
              type="button"
              onClick={() => scrollToSlide("welcome")}
              className="border border-[rgba(200,170,110,.55)] bg-[rgba(4,12,20,.55)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
            >
              BACK TO TOP
            </button>
            <Link
              href="/"
              className="border border-[rgba(200,170,110,.3)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-text-secondary transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
            >
              OTHER SUMMONERS
            </Link>
          </div>
        </div>
      </div>
    </HeroSection>
  );
};

/** The gold rule between the two halves: vertical side by side, horizontal
 * once they stack. */
const SplitRule = () => (
  <div aria-hidden className="flex items-center justify-center gap-4.5 md:h-80 md:flex-col">
    <div className="h-px w-24 bg-[linear-gradient(90deg,transparent,rgba(200,170,110,.55))] md:h-full md:w-px md:bg-[linear-gradient(180deg,transparent,rgba(200,170,110,.55))]" />
    <div className="h-2.25 w-2.25 shrink-0 rotate-45 border border-[rgba(200,170,110,.75)]" />
    <div className="h-px w-24 bg-[linear-gradient(90deg,rgba(200,170,110,.55),transparent)] md:h-full md:w-px md:bg-[linear-gradient(180deg,rgba(200,170,110,.55),transparent)]" />
  </div>
);

export { Farewell };
