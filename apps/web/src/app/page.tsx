import Link from "next/link";
import { Logo } from "@/components/logo";
import { RiotIdSearch } from "@/components/riot-id-search";
import { getRecentSummoners } from "@/lib/api";
import { platformRegionName, profileIconUrl } from "@/lib/riot";
import { summonerPath } from "@/lib/riot-id";

const SPLASH_BACKGROUND = "/images/backgrounds/optimized/how-to-rank-fast-arena-lol-12237a09a0c7.webp";
/** How many recently refreshed summoners the splash lists as shortcuts. */
const RECENT_COUNT = 8;

/**
 * Splash: the Riot ID search, plus shortcuts to the summoners refreshed
 * most recently. Searching leads to the summoner page, which queues the
 * fetch and turns into the recap once it's done.
 */
export default async function Home() {
  const recent = await getRecentSummoners(RECENT_COUNT).catch(() => []);

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
          background:
            "radial-gradient(60% 55% at 50% 44%, rgba(5,14,22,.15) 0%, rgba(3,10,18,.78) 62%, #01050a 100%)",
        }}
      />
      {/* Hextech rings turning slowly behind the logo. */}
      <div aria-hidden className="pointer-events-none absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2">
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

      <div className="relative flex w-full max-w-2xl flex-1 flex-col items-center justify-center pt-20 pb-10 text-center">
        <h1 className="splash-rise">
          <Logo size="lg" />
          <span className="sr-only"> — League of Legends Arena season recaps</span>
        </h1>
        <p
          className="splash-rise mt-10 text-[12px] tracking-[.42em] text-lol-gold-300"
          style={{ animationDelay: "120ms" }}
        >
          YOUR SEASON IN THE ARENA
        </p>
        <p
          className="splash-rise mt-3 max-w-md text-lol-text-secondary"
          style={{ animationDelay: "180ms" }}
        >
          Enter a Riot ID to relive every round, augment and win from their Arena matches.
        </p>
        <div className="splash-rise mt-9 w-full" style={{ animationDelay: "260ms" }}>
          <RiotIdSearch variant="hero" autoFocus />
          <p className="mt-1 text-xs text-lol-text-muted">
            Paste a full Riot ID like <span className="text-lol-gold-200">Sygnano#EUW</span> — it fills both fields.
          </p>
        </div>
      </div>

      {recent.length > 0 ? (
        <section
          aria-labelledby="recent-heading"
          className="splash-rise relative w-full max-w-4xl pb-14"
          style={{ animationDelay: "380ms" }}
        >
          <div className="flex items-center gap-4">
            <div aria-hidden className="h-px flex-1 bg-[linear-gradient(270deg,rgba(200,170,110,.35),transparent)]" />
            <h2 id="recent-heading" className="text-[11px] tracking-[.38em] text-lol-gold-300">
              RECENT RECAPS
            </h2>
            <div aria-hidden className="h-px flex-1 bg-[linear-gradient(90deg,rgba(200,170,110,.35),transparent)]" />
          </div>
          <ul className="mt-5 flex flex-wrap justify-center gap-2.5">
            {recent.map((summoner) => (
              <li key={summoner.puuid}>
                <Link
                  href={summonerPath(summoner.region, summoner.riotIdGameName, summoner.riotIdTagline)}
                  title={platformRegionName(summoner.region)}
                  className="group flex items-center gap-2.5 border border-[rgba(200,170,110,.25)] bg-[rgba(9,20,40,.55)] py-1.5 pr-3.5 pl-1.5 transition-colors hover:border-lol-gold-300 hover:bg-[rgba(10,50,60,.5)]"
                >
                  {summoner.profileIconId != null ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profileIconUrl(summoner.profileIconId)}
                      alt=""
                      width={28}
                      height={28}
                      className="h-7 w-7 border border-[rgba(200,170,110,.45)]"
                    />
                  ) : (
                    <span className="flex h-7 w-7 items-center justify-center border border-[rgba(200,170,110,.45)] font-display text-sm text-lol-gold-300">
                      {summoner.riotIdGameName.charAt(0)}
                    </span>
                  )}
                  <span className="font-display text-[15px] text-lol-gold-50 group-hover:text-lol-gold-100">
                    {summoner.riotIdGameName}
                    <span className="ml-1 text-[13px] text-lol-text-muted">#{summoner.riotIdTagline}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
