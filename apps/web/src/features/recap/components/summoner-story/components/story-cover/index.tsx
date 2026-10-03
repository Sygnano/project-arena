"use client";

import type { SummonerProfile } from "@arena/types";
import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Appear } from "@/components/appear";
import { IdentityRing } from "@/components/dial";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { platformRegionName, profileIconUrl } from "@/utils/riot";
import { useStartGestures } from "./hooks";

type Props = {
  profile: SummonerProfile;
  /** The season's years and date span, or null with no games. */
  period: { years: string; span: string } | null;
  /** When the matches were last fetched, with a refresh button once stale. */
  freshness: ReactNode;
  /** The full stats page. */
  advancedHref: string;
  /** Whether the cover is showing (the story isn't playing over it). */
  active: boolean;
  /** Without games there's no story to play, only the refresh. */
  hasGames: boolean;
  onStart: () => void;
};

/**
 * The summoner page's first screen: who, which season, and two ways in. The
 * story recap (the button, or scrolling down, as if the page went on) or,
 * for those who know what they're after, the full stats. It never advances
 * on its own.
 */
function StoryCover({ profile, period, freshness, advancedHref, active, hasGames, onStart }: Props) {
  useStartGestures(active && hasGames, onStart);

  return (
    <main className="relative flex h-dvh flex-col items-center justify-center overflow-hidden bg-lol-navy-950 px-6 pt-16 pb-20">
      <div
        aria-hidden
        className="absolute -inset-5 bg-cover"
        style={{
          backgroundImage: `url(${SECTION_BACKGROUNDS.welcome})`,
          backgroundPosition: "center 42%",
          filter: "blur(2px) saturate(.75) brightness(.54) contrast(1.06)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(78% 70% at 50% 48%, rgba(3,10,18,.2) 0%, rgba(2,8,14,.8) 58%, #01050a 100%)",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-10">
        <div className="absolute top-0 left-0 h-5 w-5 border-t border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute top-0 right-0 h-5 w-5 border-t border-r border-[rgba(200,170,110,.5)]" />
        <div className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute right-0 bottom-0 h-5 w-5 border-r border-b border-[rgba(200,170,110,.5)]" />
      </div>

      <div className="relative flex flex-col items-center text-center">
        <Appear from="scale" delay={0.05}>
          <IdentityRing
            size={200}
            className="scale-75 sm:scale-100 [@media(max-height:760px)]:scale-75"
            badge={
              profile.summonerLevel != null ? (
                <div
                  className="absolute bottom-3 left-1/2 flex h-8 w-8 -translate-x-1/2 rotate-45 items-center justify-center border border-[rgba(200,170,110,.75)] bg-[#040c14]"
                  aria-label={`Summoner level ${profile.summonerLevel}`}
                >
                  <div className="-rotate-45 font-display text-[14px] text-lol-gold-300">{profile.summonerLevel}</div>
                </div>
              ) : null
            }
          >
            <Avatar className="relative size-23! border border-[rgba(200,170,110,.5)]">
              {profile.profileIconId != null ? (
                <AvatarImage src={profileIconUrl(profile.profileIconId)} alt="" />
              ) : null}
              <AvatarFallback className="bg-lol-navy-800 font-display text-2xl! text-lol-gold-300">
                {profile.riotIdGameName.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </IdentityRing>
        </Appear>

        <Appear delay={0.2} className="mt-2 flex max-w-full flex-wrap items-baseline justify-center gap-x-3 sm:mt-5">
          <span className="font-display text-[clamp(24px,5.5vw,38px)] leading-none tracking-[.05em] break-all text-lol-gold-50">
            {profile.riotIdGameName}
          </span>
          <span className="font-display text-xl text-lol-text-muted sm:text-2xl">#{profile.riotIdTagline}</span>
        </Appear>

        <Appear delay={0.35}>
          <h1 className="mt-[clamp(14px,3vh,28px)] flex flex-col items-center">
            <span className="text-[12px] tracking-[.42em] text-lol-gold-300 sm:text-[13px]">YOUR ARENA SEASON</span>
            {period ? (
              <span
                className="mt-1 font-display text-[clamp(64px,13vw,120px)] leading-none tracking-[.06em] text-lol-gold-50"
                style={{ textShadow: "0 0 56px rgba(200,170,110,.3)" }}
              >
                {period.years}
              </span>
            ) : null}
          </h1>
          <div className="mt-3 text-[12px] tracking-[.26em] text-lol-text-secondary">
            {platformRegionName(profile.region).toUpperCase()}
            {period ? (
              <>
                <span className="mx-3 text-lol-gold-300" aria-hidden>
                  ◆
                </span>
                {period.span}
              </>
            ) : null}
          </div>
          <div className="mt-3 flex justify-center empty:hidden">{freshness}</div>
        </Appear>

        {hasGames ? (
          <Appear delay={0.55} className="mt-[clamp(20px,4.5vh,44px)] flex flex-col items-center">
            <button
              type="button"
              onClick={onStart}
              className="group flex items-center gap-3 border border-lol-gold-300 bg-[linear-gradient(180deg,rgba(200,170,110,.3),rgba(200,170,110,.1))] px-7 py-3.5 text-[13px] tracking-[.3em] text-lol-gold-50 shadow-[0_0_40px_rgba(200,170,110,.3)] transition-[filter,box-shadow] hover:shadow-[0_0_56px_rgba(200,170,110,.45)] hover:brightness-125"
            >
              <Play aria-hidden className="h-4 w-4 fill-current" />
              PLAY YOUR RECAP
            </button>
            <Link
              href={advancedHref}
              className="group mt-5 flex items-center gap-2 text-[13px] text-lol-text-secondary transition-colors hover:text-lol-gold-50"
            >
              Already an expert?{" "}
              <span className="text-lol-gold-200 group-hover:text-lol-gold-50">Go straight to the full stats</span>
              <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </Link>
          </Appear>
        ) : (
          <p className="mt-8 max-w-md text-sm text-lol-text-secondary">
            No Arena games tracked yet. The recap appears here once a match is picked up.
          </p>
        )}
      </div>

      {hasGames ? (
        <div
          aria-hidden
          className="kda-rise absolute inset-x-0 bottom-6 flex flex-col items-center gap-2 text-[11px] tracking-[.34em] text-lol-gold-300"
        >
          <span className="pointer-coarse:hidden">SCROLL TO START</span>
          <span className="hidden pointer-coarse:inline">SWIPE UP TO START</span>
          <svg viewBox="0 0 18 8" className="block h-2 w-4.5">
            <path d="M1 1 L9 7 L17 1" fill="none" stroke="currentColor" strokeWidth="1.4" opacity=".75" />
          </svg>
        </div>
      ) : null}
    </main>
  );
}

export { StoryCover };
