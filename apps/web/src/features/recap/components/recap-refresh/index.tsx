"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { RefreshProgress, SummonerView } from "@arena/types";
import { cn } from "cn";
import { isRefreshActive, useSummonerRefresh } from "@/features/recap/api/use-summoner-refresh";
import { formatRetryAfter } from "@/features/recap/api/summoner-query";
import { formatTimeAgo, formatUtcDateTime } from "@/utils/format";
import { BUTTON_CLASS, STALE_MS } from "./constants";
import { useMinuteClock } from "./hooks";
import { progressLabel } from "./utils";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  summoner: SummonerView;
  /** A fetch in progress when the page loaded: its progress shows right away. */
  refresh: RefreshProgress | null;
};

/**
 * The recap's data freshness, on the Welcome slide (and the "no Arena games"
 * screen): always when the matches were last fetched (the backend's
 * `lastRefreshedAt`, never a view time), a refresh button once that's over
 * 15 minutes ago, then the fetch's progress from the refresh stream, which
 * ends by putting the new recap in the query cache: the slides update in
 * place. A visitor arriving during someone else's fetch joins its progress.
 */
function RecapRefresh({ platform, gameName, tagLine, summoner, refresh }: Props) {
  const router = useRouter();
  const { state, start } = useSummonerRefresh({ platform, gameName, tagLine, autoStart: isRefreshActive(refresh) });
  const now = useMinuteClock();

  // The stream's summoner is the newer one (a finished fetch moves `lastRefreshedAt`).
  const latest = state.status === "done" || state.status === "running" ? (state.summoner ?? summoner) : summoner;

  // First games found: the "no Arena games" screen gives way to the recap.
  useEffect(() => {
    if (state.status === "done" && summoner.matchCount === 0 && state.summoner.matchCount > 0) router.refresh();
  }, [state, summoner.matchCount, router]);

  if (state.status === "running") {
    return (
      <p
        aria-live="polite"
        className="flex min-h-[30px] items-center gap-2 text-[11px] tracking-[.26em] text-lol-blue-200 tabular-nums"
      >
        <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        {progressLabel(state.progress)}
      </p>
    );
  }

  if (state.status === "error") {
    const message =
      state.code === "rate_limited"
        ? `TOO MANY REQUESTS · TRY AGAIN ${formatRetryAfter(state.retryAfterSeconds ?? 60).toUpperCase()}`
        : "UPDATE FAILED";
    return (
      <div
        role="alert"
        className="flex min-h-[30px] flex-wrap items-center justify-center gap-3 text-[11px] tracking-[.26em]"
      >
        <span className="text-[#f08a98]">{message}</span>
        <button type="button" onClick={start} className={BUTTON_CLASS}>
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          TRY AGAIN
        </button>
      </div>
    );
  }

  const lastRefreshedAt = latest.lastRefreshedAt;
  if (lastRefreshedAt === null) {
    return <p className="text-[11px] tracking-[.26em] text-lol-text-muted">LAST UPDATED · NEVER</p>;
  }
  // The server (and hydration) has no "now": it prints the exact time, and
  // the browser swaps in "27 MIN AGO" right after.
  const age = now === null ? null : now - new Date(lastRefreshedAt).getTime();
  const updated = (
    <span className="text-lol-text-muted" title={formatUtcDateTime(lastRefreshedAt)}>
      UPDATED {age === null ? formatUtcDateTime(lastRefreshedAt).toUpperCase() : formatTimeAgo(age).toUpperCase()}
    </span>
  );
  if (age === null || age <= STALE_MS) {
    return <p className="flex min-h-[30px] items-center justify-center text-[11px] tracking-[.26em]">{updated}</p>;
  }

  return (
    <div className="flex min-h-[30px] flex-wrap items-center justify-center gap-3 text-[11px] tracking-[.26em]">
      {updated}
      <button type="button" onClick={start} className={cn(BUTTON_CLASS, "group")}>
        <RefreshCw
          aria-hidden
          className="h-3.5 w-3.5 transition-transform duration-500 group-hover:rotate-180 motion-reduce:transition-none"
        />
        REFRESH
      </button>
    </div>
  );
}

export { RecapRefresh };
