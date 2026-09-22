"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "cn";
import { lookupSummoner } from "@/app/actions";
import { formatRetryAfter, isRefreshing, type SummonerStatus } from "@/lib/api";
import { formatTimeAgo, formatUtcDateTime } from "@/lib/format";
import { summonerPath } from "@/lib/riot-id";

const POLL_MS = 2000;
// Consecutive failed polls (~30s) before giving up on an update.
const MAX_POLL_FAILURES = 15;
// Mirrors the API's REFRESH_STALE_MS: a lookup only queues a refresh for a
// summoner last refreshed longer ago than this, so the button would do
// nothing before it.
const STALE_MS = 15 * 60_000;
const MINUTE_MS = 60_000;

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  initialStatus: SummonerStatus;
};

// "requesting": the lookup that queues the refresh is in flight.
type Phase = "idle" | "requesting" | "updating" | "failed";

// A clock that ticks once a minute, so the button appears when the data
// turns stale on an open page. Null on the server (no "now" to hydrate).
function subscribeToClock(onChange: () => void) {
  const id = setInterval(onChange, MINUTE_MS / 2);
  return () => clearInterval(id);
}
const readClock = () => Math.floor(Date.now() / MINUTE_MS) * MINUTE_MS;
const readServerClock = () => null;

function progressLabel(job: SummonerStatus["job"]) {
  if (job?.state === "queued") {
    return job.position === 0 ? "UPDATING · NEXT IN QUEUE" : `UPDATING · ${job.position} AHEAD IN QUEUE`;
  }
  if (job?.state === "running" && job.phase === "matches" && job.total > 0) {
    return `UPDATING · MATCH ${job.done} OF ${job.total}`;
  }
  return "UPDATING";
}

/**
 * The recap's data freshness, on the Welcome slide (and the "no Arena
 * games" screen): always when the matches were last fetched (the backend's
 * `lastRefreshedAt`, never a view time), a refresh button once that's over
 * 15 minutes ago, then the update's progress, then a `router.refresh()`
 * that swaps the new stats in. A visitor who arrives
 * while someone else's search is refreshing this summoner sees the same
 * progress (page.tsx keeps showing the recap rather than the queue screen).
 */
function RecapRefresh({ platform, gameName, tagLine, initialStatus }: Props) {
  const router = useRouter();
  const [lastRefreshedAt, setLastRefreshedAt] = useState(initialStatus.lastRefreshedAt);
  const [job, setJob] = useState(initialStatus.job);
  const [phase, setPhase] = useState<Phase>(
    isRefreshing(initialStatus) ? "updating" : initialStatus.job?.state === "failed" ? "failed" : "idle",
  );
  const now = useSyncExternalStore(subscribeToClock, readClock, readServerClock);
  // Set when the API refused the refresh (rate limit), shown instead of
  // "update failed".
  const [limitMessage, setLimitMessage] = useState<string | null>(null);

  const start = () => {
    setPhase("requesting");
    setJob(null);
    setLimitMessage(null);
    void lookupSummoner(platform, gameName, tagLine).then((result) => {
      if (!result.ok && result.error === "rate_limited") {
        setLimitMessage(`TOO MANY REQUESTS · TRY AGAIN ${formatRetryAfter(result.retryAfterSeconds).toUpperCase()}`);
      }
      setPhase(result.ok ? "updating" : "failed");
    });
  };

  useEffect(() => {
    if (phase !== "updating") return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api${summonerPath(platform, gameName, tagLine)}/status`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        const next = (await res.json()) as SummonerStatus;
        failures = 0;
        setJob(next.job);
        if (next.job?.state === "failed") {
          setPhase("failed");
          return;
        }
        // Done, or no job at all (the lookup found the data fresh enough).
        if (!isRefreshing(next)) {
          setLastRefreshedAt(next.lastRefreshedAt);
          setPhase("idle");
          router.refresh();
          return;
        }
      } catch {
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) {
          setPhase("failed");
          return;
        }
      }
      if (!cancelled) timer = setTimeout(poll, POLL_MS);
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, platform, gameName, tagLine, router]);

  const buttonClass =
    "flex items-center gap-2 border border-[rgba(200,170,110,.45)] bg-[rgba(5,14,22,.6)] px-3 py-1.5 text-lol-gold-100 transition-colors hover:border-lol-gold-300 hover:text-lol-gold-50";

  if (phase === "requesting" || phase === "updating") {
    return (
      <p aria-live="polite" className="flex min-h-[30px] items-center gap-2 text-[11px] tracking-[.26em] text-lol-blue-200 tabular-nums">
        <RefreshCw aria-hidden className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" />
        {progressLabel(job)}
      </p>
    );
  }

  if (phase === "failed") {
    return (
      <div role="alert" className="flex min-h-[30px] flex-wrap items-center justify-center gap-3 text-[11px] tracking-[.26em]">
        <span className="text-[#f08a98]">{limitMessage ?? "UPDATE FAILED"}</span>
        <button type="button" onClick={start} className={buttonClass}>
          <RefreshCw aria-hidden className="h-3.5 w-3.5" />
          TRY AGAIN
        </button>
      </div>
    );
  }

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
      <button type="button" onClick={start} className={cn(buttonClass, "group")}>
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
