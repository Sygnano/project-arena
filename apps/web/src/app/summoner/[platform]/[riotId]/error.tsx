"use client";

import Link from "next/link";

/**
 * Shown when loading a summoner's stats fails (API down, database error).
 * Previously Next's unstyled default error page.
 */
export default function SummonerError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-lol-navy-950 px-6 text-center">
      <p className="text-[12px] tracking-[.42em] text-lol-gold-300">SOMETHING WENT WRONG</p>
      <h1 className="mt-4 font-display text-4xl tracking-[.06em] text-lol-gold-50">
        STATS UNAVAILABLE
      </h1>
      <p className="mt-4 max-w-md text-lol-text-secondary">
        The stats service didn&apos;t respond. It may be restarting — try again in a moment.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="border border-[rgba(200,170,110,.55)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
        >
          TRY AGAIN
        </button>
        <Link
          href="/"
          className="border border-[rgba(200,170,110,.3)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-text-secondary transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
        >
          NEW SEARCH
        </Link>
      </div>
    </main>
  );
}
