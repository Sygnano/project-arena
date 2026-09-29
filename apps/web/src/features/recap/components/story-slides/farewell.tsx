"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import type { PlacementStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { Appear } from "@/components/appear";
import { IdentityRing } from "@/components/dial";
import { StoryFrame, StoryKicker, StoryTitle } from "@/features/recap/components/story-frame";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";

type Props = {
  totalFistBumps: number;
  placements: PlacementStats;
  matchesPlayed: number;
  /** The full stats page. */
  advancedHref: string;
  onReplay: () => void;
};

const percent = (value: number) => `${Math.round(value)}%`;

/** The story's last slide: fist bumps, the sign-off with the season in four
 * numbers, and where to go next (the full stats first). It stays up until
 * the reader chooses. */
function StoryFarewell({ totalFistBumps, placements, matchesPlayed, advancedHref, onReplay }: Props) {
  const rate = (count: number) => (matchesPlayed > 0 ? (count / matchesPlayed) * 100 : 0);
  const summary = [
    { label: "GAMES", value: matchesPlayed, className: "text-lol-gold-50" },
    { label: "AVG PLACE", value: placements.avgPlacement, decimals: 1, className: "text-lol-gold-50" },
    { label: "WINRATE", value: rate(placements.top3Finishes), format: percent, className: "text-[#e6c27a]" },
    {
      label: "1ST RATE",
      value: rate(placements.top1Finishes),
      format: percent,
      className: "bg-[linear-gradient(120deg,#f0b8dc,#c9a0ec_40%,#9fc4ef_75%,#a8e0cf)] bg-clip-text text-transparent",
    },
  ];

  return (
    <StoryFrame
      imageUrl={SECTION_BACKGROUNDS.farewell}
      tone={["rgba(200,170,110,.34)", "rgba(10,200,185,.24)"]}
      labelledBy="story-farewell-title"
      className="items-center justify-center text-center"
    >
      <Appear from="scale" delay={0.2}>
        <IdentityRing size={170} className="[@media(max-height:820px)]:[zoom:0.6]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/fistbump.jpg"
            alt=""
            width={80}
            height={80}
            style={{ filter: "brightness(1.35) contrast(1.08) saturate(1.1)" }}
            className="size-20 rounded-full border border-[rgba(200,170,110,.5)] object-cover"
          />
        </IdentityRing>
      </Appear>
      <Appear delay={0.5} className="mt-3">
        <AnimatedNumber
          value={totalFistBumps}
          className="font-display text-[clamp(44px,7vw,80px)] leading-none text-lol-gold-50"
        />
        <div className="mt-1 text-[11px] tracking-[.38em] text-lol-gold-300">FIST BUMPS GIVEN</div>
      </Appear>

      <div className="mt-[clamp(18px,4vh,40px)]">
        <StoryKicker delay={0.9} className="justify-center">
          THANKS FOR PLAYING
        </StoryKicker>
      </div>
      <StoryTitle id="story-farewell-title" delay={1} className="tracking-[.08em]">
        GG, WELL PLAYED
      </StoryTitle>

      <Appear delay={1.3} className="mt-[clamp(14px,3vh,28px)] w-full max-w-2xl">
        <dl className="grid grid-cols-4 divide-x divide-[rgba(200,170,110,.18)] border border-[rgba(200,170,110,.3)] bg-[rgba(4,12,20,.55)] py-3">
          {summary.map((stat) => (
            <div key={stat.label} className="flex flex-col-reverse items-center gap-1 px-1">
              <dt className="text-[9px] tracking-[.26em] text-lol-text-muted sm:text-[10px]">{stat.label}</dt>
              <dd className="font-display text-[clamp(18px,2.4vw,28px)] leading-none">
                <AnimatedNumber
                  value={stat.value}
                  decimals={stat.decimals}
                  format={stat.format}
                  className={stat.className}
                />
              </dd>
            </div>
          ))}
        </dl>
      </Appear>

      <Appear delay={1.7} className="mt-[clamp(20px,4.5vh,44px)] flex flex-col items-center">
        <p className="text-[15px] text-lol-text-secondary">Want the whole story, stat by stat?</p>
        <Link
          href={advancedHref}
          className="group mt-3 flex items-center gap-3 border border-lol-gold-300 bg-[linear-gradient(180deg,rgba(200,170,110,.24),rgba(200,170,110,.08))] px-6 py-3 text-[13px] tracking-[.28em] text-lol-gold-50 shadow-[0_0_32px_rgba(200,170,110,.25)] transition-[filter] hover:brightness-125"
        >
          OPEN THE FULL STATS
          <ArrowRight aria-hidden className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onReplay}
            className="flex items-center gap-2 border border-[rgba(200,170,110,.35)] px-4 py-2 text-[11px] tracking-[.26em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
          >
            <RotateCcw aria-hidden className="h-3.5 w-3.5" />
            REPLAY
          </button>
          <Link
            href="/"
            className="border border-[rgba(200,170,110,.2)] px-4 py-2 text-[11px] tracking-[.26em] text-lol-text-secondary transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
          >
            OTHER SUMMONERS
          </Link>
        </div>
      </Appear>
    </StoryFrame>
  );
}

export { StoryFarewell };
