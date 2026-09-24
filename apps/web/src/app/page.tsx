import { AnimatedNumber } from "@/components/animated-number";
import { RecentRecaps } from "@/components/recent-recaps";
import { RiotIdSearch } from "@/components/riot-id-search";
import { SiteFooter } from "@/components/site-footer";
import { SplashTitle } from "@/components/splash-title";
import { getOverview } from "@/lib/api";

const SPLASH_BACKGROUND = "/images/backgrounds/optimized/how-to-rank-fast-arena-lol-12237a09a0c7.webp";

/** One splash total: a count-up number over its caption. */
function SplashCount({ value, label }: { value: number; label: string }) {
  return (
    <p className="flex flex-col items-center gap-1.5">
      <AnimatedNumber
        value={value}
        className="font-display text-[26px] leading-none text-lol-gold-50 tabular-nums sm:text-[30px]"
      />
      <span className="text-center text-[10px] tracking-[.32em] text-lol-text-muted sm:text-[11px]">{label}</span>
    </p>
  );
}

/**
 * Splash: the Riot ID search, plus how much the site has tracked so far
 * (stored matches, summoners with a recap) and the recaps this browser
 * opened most recently. Searching leads to the summoner
 * page, which queues the fetch and turns into the recap once it's done.
 */
export default async function Home() {
  // The totals are a garnish: without the API the search still renders.
  const overview = await getOverview().catch(() => null);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col items-center overflow-hidden bg-lol-navy-950 px-4 sm:px-10">
      <div
        aria-hidden
        className="absolute -inset-8"
        style={{
          backgroundImage: `url(${SPLASH_BACKGROUND})`,
          backgroundPosition: "center 40%",
          backgroundSize: "cover",
          filter: "blur(7px) saturate(.7) brightness(.42) contrast(1.05)",
        }}
      />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: "radial-gradient(60% 55% at 50% 44%, rgba(5,14,22,.15) 0%, rgba(3,10,18,.78) 62%, #01050a 100%)",
        }}
      />
      {/* Hextech rings turning slowly behind the logo. */}
      <div aria-hidden className="pointer-events-none absolute top-[33%] left-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="welcome-spin-slow h-[min(92vw,640px)] w-[min(92vw,640px)] rounded-full border border-dashed border-[rgba(200,170,110,.14)]" />
        <div className="welcome-spin-reverse absolute inset-[14%] rounded-full border border-[rgba(10,200,185,.1)]" />
        <div className="absolute inset-[30%] rounded-full bg-[radial-gradient(circle,rgba(10,200,185,.10),transparent_70%)]" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-4 sm:inset-10">
        <div className="absolute top-0 left-0 h-5 w-5 border-t border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute top-0 right-0 h-5 w-5 border-t border-r border-[rgba(200,170,110,.5)]" />
        <div className="absolute bottom-0 left-0 h-5 w-5 border-b border-l border-[rgba(200,170,110,.5)]" />
        <div className="absolute right-0 bottom-0 h-5 w-5 border-r border-b border-[rgba(200,170,110,.5)]" />
      </div>

      <div className="relative flex w-full max-w-2xl flex-1 flex-col items-center justify-center pt-10 pb-24 text-center">
        <h1 className="splash-rise">
          <SplashTitle />
          <span className="sr-only"> — League of Legends Arena season recaps</span>
        </h1>
        <p
          className="splash-rise mt-10 text-[12px] tracking-[.42em] text-lol-gold-300"
          style={{ animationDelay: "120ms" }}
        >
          YOUR SEASON IN THE ARENA
        </p>
        <p className="splash-rise mt-3 max-w-md text-lol-text-secondary" style={{ animationDelay: "180ms" }}>
          Retrace the steps you took in the Rings of Wrath. Start by entering a summoner&apos;s name and tag.
        </p>
        <div className="splash-rise mt-9 w-full" style={{ animationDelay: "260ms" }}>
          <RiotIdSearch variant="hero" autoFocus />
        </div>
        {/* This browser's own history, so it appears after hydration. */}
        <RecentRecaps className="splash-rise w-full" />
        {overview && overview.recapCount > 0 ? (
          <section
            aria-label="Tracked so far"
            className="splash-rise relative mt-24 w-full"
            style={{ animationDelay: "380ms" }}
          >
            <div className="flex items-center gap-4 sm:gap-8">
              <div aria-hidden className="h-px flex-1 bg-[linear-gradient(270deg,rgba(200,170,110,.35),transparent)]" />
              <SplashCount value={overview.matchCount} label="MATCHES TRACKED" />
              <span aria-hidden className="text-[10px] text-lol-gold-300">
                ◆
              </span>
              <SplashCount value={overview.recapCount} label="SUMMONER RECAPS" />
              <div aria-hidden className="h-px flex-1 bg-[linear-gradient(90deg,rgba(200,170,110,.35),transparent)]" />
            </div>
          </section>
        ) : null}
      </div>

      <SiteFooter className="pb-6" />
    </main>
  );
}
