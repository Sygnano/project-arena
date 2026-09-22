"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { lookupSummoner } from "@/app/actions";
import { HextechEmblem, NewSearchLink, StatusScreen, actionClass } from "@/components/status-screen";
import { formatRetryAfter, type LookupResult, type SummonerStatus } from "@/lib/api";
import { platformRegionName, profileIconUrl } from "@/lib/riot";
import { summonerPath } from "@/lib/riot-id";

const POLL_MS = 2000;
// Consecutive failed status polls (~30s) before showing "unavailable"
// instead of a progress screen that silently stopped moving.
const MAX_POLL_FAILURES = 15;

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  /** The server's status read; null when the Riot ID isn't tracked yet. */
  initialStatus: SummonerStatus | null;
};

// "idle": never fetched, waiting for the "fetch matches" button.
// "lookup": the button's lookup (which queues the fetch) is in flight.
// "limited": the API refused the fetch for now (rate limit, or a full queue).
type Phase =
  | "idle"
  | "lookup"
  | "waiting"
  | "assembling"
  | "failed"
  | "not-found"
  | "unavailable"
  | "limited";

function isActive(status: SummonerStatus | null) {
  const state = status?.job?.state;
  return state === "queued" || state === "running";
}

function formatEta(seconds: number) {
  if (seconds < 60) return "less than a minute left";
  const minutes = Math.round(seconds / 60);
  return `about ${minutes} min left`;
}

/** The emblem with the summoner's profile icon at its heart, when known. */
function SummonerEmblem({ profileIconId }: { profileIconId: number | null }) {
  if (profileIconId === null) return <HextechEmblem />;
  return (
    <HextechEmblem>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={profileIconUrl(profileIconId)}
        alt=""
        className="absolute inset-[46px] h-[68px] w-[68px] border border-[rgba(200,170,110,.5)]"
      />
    </HextechEmblem>
  );
}

/** The emblem with a progress ring around it while matches are fetched. */
function ProgressEmblem({ fraction }: { fraction: number | null }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  return (
    <HextechEmblem>
      <div className="dial-breathe absolute inset-[62px] rotate-45 bg-lol-gold-300/70" />
      <svg viewBox="0 0 160 160" className="absolute inset-0 -rotate-90 overflow-visible">
        <defs>
          <linearGradient id="refresh-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#c8aa6e" />
            <stop offset="1" stopColor="#0ac8b9" />
          </linearGradient>
        </defs>
        {fraction !== null ? (
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            stroke="url(#refresh-ring)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - fraction)}
            style={{
              transition: "stroke-dashoffset .8s ease-out",
              filter: "drop-shadow(0 0 4px rgba(10,200,185,.6))",
            }}
          />
        ) : null}
      </svg>
    </HextechEmblem>
  );
}

/**
 * The summoner page until its first recap exists. A never-fetched summoner
 * (or a Riot ID not tracked yet) shows "last updated: never" and a "fetch
 * matches" button; nothing is asked of Riot until it's pressed. Then: queue
 * position, match-by-match progress, and a hand-off to the recap on the
 * same URL (a `router.refresh()`, after which page.tsx renders the recap).
 * Polls the status through the web app's own route (`/api/summoner/.../status`).
 */
function RefreshView({ platform, gameName, tagLine, initialStatus }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState(initialStatus);
  const [phase, setPhase] = useState<Phase>(
    isActive(initialStatus) ? "waiting" : initialStatus?.job?.state === "failed" ? "failed" : "idle",
  );
  const handedOff = useRef(false);
  // Why "limited" refused, shown on that screen.
  const [limitMessage, setLimitMessage] = useState("");

  const applyLookup = useCallback(
    (result: LookupResult) => {
      if (!result.ok) {
        if (result.error === "rate_limited") {
          setLimitMessage(
            `Too many fetches from your connection. Try again ${formatRetryAfter(result.retryAfterSeconds)}.`,
          );
          setPhase("limited");
        } else if (result.error === "busy") {
          setLimitMessage("The fetch queue is full right now. Try again in a few minutes.");
          setPhase("limited");
        } else {
          setPhase(result.error === "unavailable" ? "unavailable" : "not-found");
        }
        return;
      }
      // Riot's canonical casing: keep the shared URL tidy.
      const canonical = summonerPath(result.region, result.gameName, result.tagLine);
      if (decodeURIComponent(canonical) !== decodeURIComponent(pathname)) router.replace(canonical);
      setPhase("waiting");
    },
    [pathname, router],
  );

  // The "fetch matches" button, and "try again" after a failure.
  const startFetch = () => {
    setPhase("lookup");
    handedOff.current = false;
    void lookupSummoner(platform, gameName, tagLine, true).then(applyLookup);
  };

  useEffect(() => {
    if (phase !== "waiting") return;
    let cancelled = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch(`/api${summonerPath(platform, gameName, tagLine)}/status`, { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) throw new Error(`status ${res.status}`);
        failures = 0;
        const next = (await res.json()) as SummonerStatus;
        setStatus(next);
        const state = next.job?.state;
        // The API's queue lives in memory: after a restart the job is
        // gone while this page still waits on it. Queue it again.
        if (!state && next.lastRefreshedAt === null) {
          const result = await lookupSummoner(platform, gameName, tagLine, true);
          if (cancelled) return;
          if (!result.ok) {
            applyLookup(result);
            return;
          }
        }
        if (state === "failed") {
          setPhase("failed");
          return;
        }
        if (state === "done" || (!state && next.lastRefreshedAt !== null)) {
          if (!handedOff.current) {
            handedOff.current = true;
            setPhase("assembling");
            router.refresh();
          }
          return;
        }
      } catch {
        // A missed poll is retried on the next tick, up to a point.
        if (cancelled) return;
        failures += 1;
        if (failures >= MAX_POLL_FAILURES) {
          setPhase("unavailable");
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
  }, [phase, platform, gameName, tagLine, router, applyLookup]);

  const title = (
    <>
      {status?.gameName ?? gameName}
      <span className="ml-2 text-[.7em] text-lol-text-muted">#{status?.tagLine ?? tagLine}</span>
    </>
  );
  const server = platformRegionName(platform);

  if (phase === "not-found") {
    return (
      <StatusScreen eyebrow="NO SUCH SUMMONER" title={title} actions={<NewSearchLink />}>
        <p className="text-lol-text-secondary">
          Riot has no summoner with this Riot ID on {server}. Check the spelling and the server.
        </p>
      </StatusScreen>
    );
  }

  if (phase === "limited") {
    return (
      <StatusScreen
        eyebrow="HOLD ON"
        title={title}
        actions={
          <>
            <button type="button" onClick={startFetch} className={actionClass}>
              TRY AGAIN
            </button>
            <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
          </>
        }
      >
        <p className="text-lol-text-secondary">{limitMessage}</p>
      </StatusScreen>
    );
  }

  if (phase === "unavailable" || phase === "failed") {
    return (
      <StatusScreen
        eyebrow={phase === "failed" ? "THE FORGE STALLED" : "SOMETHING WENT WRONG"}
        title={title}
        actions={
          <>
            <button
              type="button"
              onClick={startFetch}
              className={actionClass}
            >
              TRY AGAIN
            </button>
            <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
          </>
        }
      >
        <p className="text-lol-text-secondary">
          {phase === "failed"
            ? "Fetching matches from Riot failed partway. Matches already fetched are kept, so trying again picks up where it stopped."
            : "The stats service didn't respond. It may be restarting — try again in a moment."}
        </p>
      </StatusScreen>
    );
  }

  if (phase === "idle") {
    return (
      <StatusScreen
        eyebrow="NO RECAP YET"
        title={title}
        emblem={<SummonerEmblem profileIconId={status?.profileIconId ?? null} />}
        actions={
          <>
            <button type="button" onClick={startFetch} className={actionClass}>
              FETCH MATCHES
            </button>
            <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
          </>
        }
      >
        <p className="text-[12px] tracking-[.26em] text-lol-text-muted">LAST UPDATED · NEVER</p>
        <p className="mt-4 text-lol-text-secondary">
          This summoner&apos;s Arena matches haven&apos;t been fetched from {server} yet. Fetch them
          to build their season recap.
        </p>
      </StatusScreen>
    );
  }

  const job = status?.job;
  const fetching = phase === "waiting" && job?.state === "running" && job.phase === "matches" && job.total > 0;
  const fraction = phase === "assembling" ? 1 : fetching ? job.done / job.total : null;

  let eyebrow = "SUMMONING";
  let detail = `Looking up this Riot ID on ${server}…`;
  if (phase === "assembling") {
    eyebrow = "FORGING YOUR RECAP";
    detail = "Every match is in. Putting the season together…";
  } else if (job?.state === "queued") {
    eyebrow = "IN QUEUE";
    detail =
      job.position === 0
        ? "You're next."
        : `${job.position} ${job.position === 1 ? "summoner" : "summoners"} ahead of you.`;
  } else if (job?.state === "running" && !fetching) {
    eyebrow = "SCOUTING MATCH HISTORY";
    detail = "Reading the list of Arena matches from Riot…";
  } else if (fetching) {
    eyebrow = "FETCHING MATCHES";
    detail = `Match ${job.done} of ${job.total}${job.etaSeconds !== null ? ` · ${formatEta(job.etaSeconds)}` : ""}`;
  }

  return (
    <StatusScreen busy eyebrow={eyebrow} title={title} emblem={<ProgressEmblem fraction={fraction} />}>
      <p aria-live="polite" className="text-lol-gold-100 tabular-nums">
        {detail}
      </p>
      {fetching ? (
        <div
          role="progressbar"
          aria-label="Matches fetched"
          aria-valuemin={0}
          aria-valuemax={job.total}
          aria-valuenow={job.done}
          className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden bg-[rgba(200,170,110,.15)]"
        >
          <div
            className="h-full bg-[linear-gradient(90deg,#c8aa6e,#0ac8b9)] shadow-[0_0_8px_rgba(10,200,185,.6)] transition-[width] duration-700 ease-out"
            style={{ width: `${(job.done / job.total) * 100}%` }}
          />
        </div>
      ) : null}
      <p className="mt-6 text-sm text-lol-text-muted">
        Riot lets us fetch about 50 matches every two minutes, so a first visit can take a while. Keep
        this tab open, or share the link: it shows the recap once it&apos;s ready.
      </p>
    </StatusScreen>
  );
}

export { RefreshView };
