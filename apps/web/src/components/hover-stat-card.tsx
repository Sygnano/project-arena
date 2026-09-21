"use client";

import type { ReactNode } from "react";
import type { ChampionGames } from "@arena/types";
import { championIconUrl } from "@/lib/riot";
import { useChampionName } from "@/lib/champion-names";
import { ordinal } from "@/lib/format";
import { TIER_STYLE } from "@/lib/tier-bars";

/**
 * The Hextech hover card behind the page's chart tooltips (Placement bars,
 * activity calendar days, hour columns): a title line with a count on the
 * right, a muted subtitle, then any number of `HoverCardSection`s.
 */
function HoverStatCard({
  title,
  meta,
  subtitle,
  edgeColor = "rgba(200,170,110,.45)",
  children,
}: {
  title: ReactNode;
  meta?: ReactNode;
  subtitle?: ReactNode;
  /** Border color — the tier edge of whatever the card describes. */
  edgeColor?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className="w-60 border bg-lol-navy-900/95 px-3.5 py-3 text-xs shadow-[0_8px_24px_rgba(0,0,0,.55)] backdrop-blur-sm"
      style={{ borderColor: edgeColor }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-display text-[15px] tracking-[.06em] whitespace-nowrap text-lol-gold-50">
          {title}
        </div>
        {meta ? <div className="whitespace-nowrap text-lol-text-muted">{meta}</div> : null}
      </div>
      {subtitle ? <div className="mt-0.5 text-lol-text-muted">{subtitle}</div> : null}
      {children}
    </div>
  );
}

function HoverCardSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <>
      <div className="my-2.5 h-px bg-[rgba(200,170,110,.25)]" />
      {label ? (
        <div className="mb-1 text-[10px] tracking-[.22em] text-lol-text-muted">{label}</div>
      ) : null}
      {children}
    </>
  );
}

function HoverCardRows({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return rows.map((row) => (
    <div key={row.label} className="flex justify-between gap-3 py-0.5">
      <span className="tracking-[.12em] text-lol-text-muted">{row.label}</span>
      <span className="font-display text-lol-gold-50">{row.value}</span>
    </div>
  ));
}

/** Champion icons, each with its name and a count underneath ("games" by
 * default; `noun` for other counts, e.g. "kill"). `detail` adds a line under
 * the count. */
function HoverCardChampions<T extends ChampionGames>({
  champions,
  noun = "game",
  detail,
}: {
  champions: readonly T[];
  noun?: string;
  detail?: (champion: T) => ReactNode;
}) {
  const championName = useChampionName();
  return (
    <div className="flex gap-3">
      {champions.map((champion) => (
        <div key={champion.championName} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={championIconUrl(champion.championName)}
            alt=""
            className="size-9 border border-[rgba(200,170,110,.4)]"
          />
          <div className="w-full truncate text-center font-display text-[11px] text-lol-gold-50">
            {championName(champion.championName)}
          </div>
          <div className="text-[10px] text-lol-text-muted">
            {champion.games} {noun}{champion.games === 1 ? "" : "s"}
          </div>
          {detail ? (
            <div className="text-[10px] tracking-[.08em] text-lol-text-muted">{detail(champion)}</div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** One small bar per finishing place (index 0 = 1st), tier-colored like the
 * stacked charts and scaled to the most common place. Its length comes from
 * the data, never a fixed team count (CLAUDE.md §2). */
function HoverCardPlacementBars({ counts }: { counts: readonly number[] }) {
  const max = Math.max(1, ...counts);
  return (
    <div className="flex flex-col gap-1">
      {counts.map((count, index) => {
        const placement = index + 1;
        const tier =
          placement === 1 ? TIER_STYLE.prismatic : placement <= 3 ? TIER_STYLE.gold : TIER_STYLE.silver;
        return (
          <div key={placement} className="flex items-center gap-2">
            <span className="w-7 text-lol-text-muted">{ordinal(placement)}</span>
            <div className="h-2 flex-1">
              <div className={`h-full ${tier.fillClass}`} style={{ width: `${(count / max) * 100}%` }} />
            </div>
            <span className="w-5 text-right font-display text-lol-gold-50">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

export {
  HoverStatCard,
  HoverCardSection,
  HoverCardRows,
  HoverCardChampions,
  HoverCardPlacementBars,
};
