import type { Overview } from "@/features/overview/api/get-overview";
import { SplashCount } from "./components/splash-count";

type Props = { overview: Overview };

/** How much the site has tracked so far: stored matches and summoners with a recap. */
function TrackedSoFar({ overview }: Props) {
  return (
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
  );
}

export { TrackedSoFar };
