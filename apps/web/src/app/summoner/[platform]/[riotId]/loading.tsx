/**
 * Shown while the summoner's stats are fetched server-side (a cold, uncached
 * build takes several seconds). Mirrors the Welcome screen's centered
 * composition so the real page settles in place instead of jumping.
 */
export default function Loading() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-dvh flex-col items-center justify-center bg-lol-navy-950 px-6"
    >
      <div aria-hidden className="relative h-40 w-40">
        <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
        <div className="welcome-spin-reverse absolute inset-5 rotate-45 border border-[rgba(200,170,110,.45)]" />
        <div className="dial-breathe absolute inset-[62px] rotate-45 bg-lol-gold-300/70" />
      </div>
      <p className="mt-10 text-[12px] tracking-[.42em] text-lol-gold-300">GATHERING ARENA STATS</p>
      <p className="mt-3 text-sm text-lol-text-muted">This can take a few seconds the first time.</p>
    </main>
  );
}
