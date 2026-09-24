import Link from "next/link";

/**
 * Shown for a malformed summoner URL (no "Name-TAG" slug). A well-formed
 * Riot ID that isn't tracked yet never lands here — the page looks it up.
 */
export default function SummonerNotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-lol-navy-950 px-6 text-center">
      <p className="text-[12px] tracking-[.42em] text-lol-gold-300">BROKEN LINK</p>
      <h1 className="mt-4 font-display text-4xl tracking-[.06em] text-lol-gold-50">SUMMONER NOT FOUND</h1>
      <p className="mt-4 max-w-md text-lol-text-secondary">
        This link doesn&apos;t hold a valid Riot ID. Search for the summoner instead.
      </p>
      <Link
        href="/"
        className="mt-8 border border-[rgba(200,170,110,.55)] px-5 py-2.5 text-[12px] tracking-[.26em] text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50"
      >
        NEW SEARCH
      </Link>
    </main>
  );
}
