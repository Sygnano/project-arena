"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import type { SummonerPageData } from "@arena/types";
import { HextechEmblem, NewSearchLink, StatusScreen, actionClass } from "@/components/status-screen";
import { isRefreshActive, useSummonerRefresh } from "@/hooks/use-summoner-refresh";
import { formatRetryAfter } from "@/lib/summoner-query";
import { platformRegionName, profileIconUrl } from "@/lib/riot";
import { summonerPath } from "@/lib/riot-id";
import { SummonerRecap } from "./recap";

type Props = {
  platform: string;
  gameName: string;
  tagLine: string;
  /** The stored summoner and their fetch; null when the Riot ID isn't stored yet. */
  initial: SummonerPageData | null;
};

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
 * The summoner page until their first recap: "last updated: never" and a
 * "fetch matches" button (also for a Riot ID not stored yet). Nothing is
 * asked of Riot until it's pressed. The button opens the refresh stream:
 * Riot ID lookup, queue position, match by match, and finally the recap,
 * which replaces this screen in place. A visitor arriving during someone
 * else's fetch joins its progress.
 */
function RefreshView({ platform, gameName, tagLine, initial }: Props) {
  const pathname = usePathname();
  const { state, start } = useSummonerRefresh({
    platform,
    gameName,
    tagLine,
    autoStart: isRefreshActive(initial?.refresh),
  });
  const summoner = (state.status !== "idle" ? state.summoner : null) ?? initial?.summoner ?? null;

  // Riot's casing, once known, keeps the shared URL tidy. History only: a
  // navigation would remount this screen and drop the stream.
  useEffect(() => {
    if (!summoner) return;
    const canonical = summonerPath(summoner.region, summoner.gameName, summoner.tagLine);
    if (decodeURIComponent(canonical) !== decodeURIComponent(pathname))
      window.history.replaceState(null, "", canonical);
  }, [summoner, pathname]);

  if (state.status === "done") {
    return (
      <SummonerRecap
        platform={platform}
        gameName={gameName}
        tagLine={tagLine}
        summoner={state.summoner}
        refresh={null}
      />
    );
  }

  const title = (
    <>
      {summoner?.gameName ?? gameName}
      <span className="ml-2 text-[.7em] text-lol-text-muted">#{summoner?.tagLine ?? tagLine}</span>
    </>
  );
  const server = platformRegionName(platform);
  const retry = (
    <>
      <button type="button" onClick={start} className={actionClass}>
        TRY AGAIN
      </button>
      <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
    </>
  );

  if (state.status === "error") {
    switch (state.code) {
      case "not_found":
        return (
          <StatusScreen eyebrow="NO SUCH SUMMONER" title={title} actions={<NewSearchLink />}>
            <p className="text-lol-text-secondary">
              Riot has no summoner with this Riot ID on {server}. Check the spelling and the server.
            </p>
          </StatusScreen>
        );
      case "rate_limited":
      case "busy":
        return (
          <StatusScreen eyebrow="HOLD ON" title={title} actions={retry}>
            <p className="text-lol-text-secondary">
              {state.code === "busy"
                ? "Too many fetches are running right now. Try again in a few minutes."
                : `Too many fetches from your connection. Try again ${formatRetryAfter(state.retryAfterSeconds ?? 60)}.`}
            </p>
          </StatusScreen>
        );
      default:
        return (
          <StatusScreen
            eyebrow={state.code === "failed" ? "THE FORGE STALLED" : "SOMETHING WENT WRONG"}
            title={title}
            actions={retry}
          >
            <p className="text-lol-text-secondary">
              {state.code === "failed"
                ? "Fetching matches from Riot failed partway. Matches already fetched are kept, so trying again picks up where it stopped."
                : "The stats service didn't respond. It may be restarting — try again in a moment."}
            </p>
          </StatusScreen>
        );
    }
  }

  if (state.status === "idle") {
    return (
      <StatusScreen
        eyebrow="NO RECAP YET"
        title={title}
        emblem={<SummonerEmblem profileIconId={summoner?.profileIconId ?? null} />}
        actions={
          <>
            <button type="button" onClick={start} className={actionClass}>
              FETCH MATCHES
            </button>
            <NewSearchLink className="border-[rgba(200,170,110,.3)] text-lol-text-secondary" />
          </>
        }
      >
        <p className="text-[12px] tracking-[.26em] text-lol-text-muted">LAST UPDATED · NEVER</p>
        <p className="mt-4 text-lol-text-secondary">
          This summoner&apos;s Arena matches haven&apos;t been fetched from {server} yet. Fetch them to build their
          season recap.
        </p>
      </StatusScreen>
    );
  }

  const progress = state.progress;
  const assembling = progress?.state === "done";
  const fetching = progress?.state === "running" && progress.phase === "matches" && progress.total > 0;
  const fraction = assembling ? 1 : fetching ? progress.done / progress.total : null;

  let eyebrow = "SUMMONING";
  let detail = `Looking up this Riot ID on ${server}…`;
  if (assembling) {
    eyebrow = "FORGING YOUR RECAP";
    detail = "Every match is in. Putting the season together…";
  } else if (progress?.state === "queued") {
    eyebrow = "IN QUEUE";
    detail =
      progress.position === 0
        ? "You're next."
        : `${progress.position} ${progress.position === 1 ? "summoner" : "summoners"} ahead of you.`;
  } else if (progress?.state === "running" && progress.waitingOnRiot) {
    // Held at the Riot gateway: behind other requests, or out of Riot budget.
    eyebrow = "WAITING ON RIOT";
    detail = fetching
      ? `Match ${progress.done} of ${progress.total} · Riot is busy, the fetch resumes as soon as it lets us through`
      : "Riot is busy. The fetch resumes as soon as it lets us through…";
  } else if (progress?.state === "running" && !fetching) {
    eyebrow = "SCOUTING MATCH HISTORY";
    detail = "Reading the list of Arena matches from Riot…";
  } else if (fetching) {
    eyebrow = "FETCHING MATCHES";
    detail = `Match ${progress.done} of ${progress.total}${progress.etaSeconds !== null ? ` · ${formatEta(progress.etaSeconds)}` : ""}`;
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
          aria-valuemax={progress.total}
          aria-valuenow={progress.done}
          className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden bg-[rgba(200,170,110,.15)]"
        >
          <div
            className="h-full bg-[linear-gradient(90deg,#c8aa6e,#0ac8b9)] shadow-[0_0_8px_rgba(10,200,185,.6)] transition-[width] duration-700 ease-out"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      ) : null}
      <p className="mt-6 text-sm text-lol-text-muted">
        Riot limits how fast matches can be fetched, so a first visit can take a while. Keep this tab open, or share the
        link: it shows the recap once it&apos;s ready.
      </p>
    </StatusScreen>
  );
}

export { RefreshView };
