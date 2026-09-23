import Link from "next/link";
import { formatRetryAfter } from "@/lib/summoner-query";

/** Shown instead of a recap when this visitor opened too many recaps in a
 * short time (the API's per-visitor limit on recap reads). */
export function RateLimitedView({ retryAfterSeconds }: { retryAfterSeconds: number }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-lol-navy-950 px-6 text-center">
      <p className="text-[12px] tracking-[.42em] text-lol-gold-300">HOLD ON</p>
      <h1 className="mt-4 font-display text-4xl tracking-[.06em] text-lol-gold-50">TOO MANY RECAPS</h1>
      <p className="mt-4 max-w-md text-lol-text-secondary">
        You opened a lot of recaps in a short time. Try again {formatRetryAfter(retryAfterSeconds)}.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
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
