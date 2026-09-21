"use client";

import type { SummonerProfile } from "@arena/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AnimatedNumber } from "@/components/animated-number";
import { IdentityRing } from "@/components/dial";
import { HeroSection } from "@/components/hero-section";
import { SlideCue } from "@/components/slide-cue";
import { profileIconUrl, platformRegionName } from "@/lib/riot";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  profile: SummonerProfile;
  /** Earliest tracked match day (`YYYY-MM-DD`, UTC), or null with no games. */
  firstTrackedDate: string | null;
  /** ISO time of the most recent tracked match, or null with no games. */
  lastMatchAt: string | null;
  /** Total time played across every tracked match — the one teaser total. */
  timePlayedSeconds: number;
};

const DAY_MONTH = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const DAY_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** The season's years and date span, from the first to the last tracked
 * game: `{ years: "2026", span: "12 MAR – 18 SEP 2026" }`, or a two-year
 * `"2025–26"` when the tracked period crosses New Year. */
function seasonPeriod(firstDay: string, lastMatchAt: string) {
  const start = new Date(`${firstDay}T00:00:00Z`);
  const end = new Date(lastMatchAt);
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  const sameYear = startYear === endYear;
  return {
    years: sameYear ? String(endYear) : `${startYear}–${String(endYear).slice(-2)}`,
    span: `${(sameYear ? DAY_MONTH : DAY_MONTH_YEAR).format(start)} – ${DAY_MONTH_YEAR.format(end)}`.toUpperCase(),
  };
}

/**
 * The summoner page's title card — the cover of the season wrap. It shows
 * who this is and which period the wrap covers, plus a single teaser total
 * (time spent in the Arena), and deliberately nothing else: the headline
 * results (games, average place, winrate, 1st rate) are the payoff of the
 * `Farewell` finale, not something to give away in the first second.
 */
const Welcome = ({ profile, firstTrackedDate, lastMatchAt, timePlayedSeconds }: Props) => {
  const period =
    firstTrackedDate && lastMatchAt ? seasonPeriod(firstTrackedDate, lastMatchAt) : null;
  // Under an hour, hours would read as a bare "0"; count minutes instead.
  const inHours = timePlayedSeconds >= 3600;
  const teaser = inHours ? timePlayedSeconds / 3600 : timePlayedSeconds / 60;

  return (
    <HeroSection
      imageUrl={SECTION_BACKGROUNDS.welcome}
      labelledBy="welcome-title"
      eager
      footer={<SlideCue className="bottom-8" prefix="BEGIN" />}
    >
      <IdentityRing
        size={228}
        className="scale-75 sm:scale-100"
        badge={
          profile.summonerLevel != null ? (
            <div
              className="absolute bottom-3.5 left-1/2 flex h-9 w-9 -translate-x-1/2 rotate-45 items-center justify-center border border-[rgba(200,170,110,.75)] bg-[#040c14]"
              aria-label={`Summoner level ${profile.summonerLevel}`}
            >
              <div className="-rotate-45 font-display text-[15px] text-lol-gold-300">
                {profile.summonerLevel}
              </div>
            </div>
          ) : null
        }
      >
        <Avatar className="relative size-26! border border-[rgba(200,170,110,.5)]">
          {profile.profileIconId != null ? (
            <AvatarImage src={profileIconUrl(profile.profileIconId)} alt="" />
          ) : null}
          <AvatarFallback className="bg-lol-navy-800 font-display text-2xl! text-lol-gold-300">
            {profile.riotIdGameName.charAt(0)}
          </AvatarFallback>
        </Avatar>
      </IdentityRing>

      <div className="mt-5 flex max-w-full flex-wrap items-baseline justify-center gap-x-3 text-center sm:mt-8">
        <span className="font-display text-[clamp(26px,6vw,40px)] leading-none tracking-[.05em] break-all text-lol-gold-50">
          {profile.riotIdGameName}
        </span>
        <span className="font-display text-xl text-[#a09b8c] sm:text-2xl">
          #{profile.riotIdTagline}
        </span>
      </div>

      <h1 id="welcome-title" className="mt-7 flex flex-col items-center text-center">
        <span className="text-[12px] tracking-[.42em] text-lol-gold-300 sm:text-[13px]">
          YOUR ARENA SEASON
        </span>
        {period ? (
          <span
            className="mt-2 font-display text-[clamp(72px,15vw,132px)] leading-none tracking-[.06em] text-lol-gold-50"
            style={{ textShadow: "0 0 56px rgba(200,170,110,.3)" }}
          >
            {period.years}
          </span>
        ) : null}
      </h1>

      <div className="mt-5 text-center text-[12px] tracking-[.26em] text-lol-text-secondary">
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

      {profile.matchesPlayed > 0 ? (
        <p className="mt-8 flex items-baseline gap-3 border-y border-[rgba(200,170,110,.25)] px-6 py-3">
          <AnimatedNumber
            value={teaser}
            className="font-display text-[30px] leading-none text-lol-gold-300 sm:text-[34px]"
          />
          <span className="text-[11px] tracking-[.3em] text-lol-text-muted">
            {inHours ? "HOURS IN THE ARENA" : "MINUTES IN THE ARENA"}
          </span>
        </p>
      ) : (
        <p className="mt-8 max-w-md text-center text-sm text-lol-text-secondary">
          No Arena games tracked yet. Stats appear here after the next ingestion run picks up a
          match.
        </p>
      )}
    </HeroSection>
  );
};

export { Welcome };
