"use client";

import type { ReactNode } from "react";
import { formatSignedPoints } from "@/components/delta-cell";
import { HoverCardRows, HoverCardSection, HoverStatCard } from "@/components/hover-stat-card";
import { isLowSample } from "@/lib/sample";
import { TIER_STYLE } from "@/lib/tier-bars";

type Props = {
  name: string;
  iconUrl: string | undefined;
  /** Round icon (augments) instead of square (champions, items). */
  roundIcon?: boolean;
  /** Small caps line under the name, e.g. "PRISMATIC AUGMENT". */
  kicker?: string;
  /** Label of the games row: "PICKED" or "HELD". */
  countLabel: string;
  top1: number;
  top3ExclTop1: number;
  remaining: number;
  /** Rank line ("#3 of 40 by winrate"); omit where the list isn't ranked,
   * like the Augment God grid. */
  rank?: number;
  total?: number;
  /** Rank basis, e.g. "BY WINRATE". */
  sortNoun?: string;
  /** Winrate of the average pick (`pooledRate`), for per-augment/per-item
   * lists; omit for champions, whose fair baseline is the per-game rate. */
  averageWinRate?: number;
  /** What `averageWinRate` compares against, e.g. "AVG PICK". */
  averageLabel?: string;
  /** The "click to pin" footer, for charts whose click fills a sidebar. */
  pinHint?: boolean;
  /** Replaces the rates and finishes sections, for charts whose pinned
   * sidebar already shows them (the card should complement it instead). */
  body?: ReactNode;
};

function percent(part: number, whole: number) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

/**
 * Hover card for the picks-style stacked bar charts (Champion Picks, Augments,
 * Prismatic Items): names the column (the chart itself only shows an icon),
 * its rates and rank, and its finishes as one proportional strip. A click
 * still pins the column in the sidebar.
 */
function PickHoverCard({
  name,
  iconUrl,
  roundIcon = false,
  kicker,
  countLabel,
  top1,
  top3ExclTop1,
  remaining,
  rank,
  total,
  sortNoun,
  averageWinRate,
  averageLabel = "AVG PICK",
  pinHint = true,
  body,
}: Props) {
  const games = top1 + top3ExclTop1 + remaining;
  const winRate = percent(top1 + top3ExclTop1, games);
  const lowSample = isLowSample(games);
  const segments = [
    { key: "1st", label: "1ST", count: top1, tier: TIER_STYLE.prismatic },
    {
      key: "top3",
      label: "2ND–3RD",
      count: top3ExclTop1,
      tier: TIER_STYLE.gold,
    },
    { key: "rest", label: "4TH+", count: remaining, tier: TIER_STYLE.silver },
  ];

  return (
    <HoverStatCard
      title={
        <span className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={iconUrl}
            alt=""
            className={`size-8 flex-none border border-[rgba(200,170,110,.4)] ${roundIcon ? "rounded-full" : ""}`}
          />
          <span className="min-w-0 whitespace-normal leading-tight">
            {name}
            {kicker ? (
              <span className="mt-0.5 block font-body text-[10px] tracking-[.2em] text-lol-text-muted">{kicker}</span>
            ) : null}
          </span>
        </span>
      }
      subtitle={
        rank !== undefined ? (
          <span className="mt-1.5 block">
            #{rank} of {total} {sortNoun?.toLowerCase()}
            {lowSample ? " · few games" : ""}
          </span>
        ) : lowSample ? (
          <span className="mt-1.5 block">few games</span>
        ) : undefined
      }
    >
      {body ?? (
        <>
          <HoverCardSection>
            <HoverCardRows
              rows={[
                {
                  label: countLabel,
                  value: `${games.toLocaleString()} game${games === 1 ? "" : "s"}`,
                },
                {
                  label: "WINRATE",
                  value: `${winRate.toFixed(0)}%`,
                },
                {
                  label: "1ST RATE",
                  value: `${percent(top1, games).toFixed(0)}%`,
                },
                ...(averageWinRate !== undefined
                  ? [
                      {
                        label: `VS ${averageLabel}`,
                        value: lowSample ? "—" : formatSignedPoints(winRate - averageWinRate, 0),
                      },
                    ]
                  : []),
              ]}
            />
          </HoverCardSection>
          <HoverCardSection label="FINISHES">
            <div className="flex h-2.5 w-full gap-px overflow-hidden">
              {segments.map((segment) =>
                segment.count > 0 ? (
                  <div
                    key={segment.key}
                    className={segment.tier.fillClass}
                    style={{ flexGrow: segment.count, flexBasis: 0 }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-1.5 flex justify-between text-[10px] tracking-[.14em] text-lol-text-muted">
              {segments.map((segment) => (
                <span key={segment.key}>
                  {segment.label} <span className="font-display text-lol-gold-50">{segment.count}</span>
                </span>
              ))}
            </div>
          </HoverCardSection>
        </>
      )}
      {pinHint ? (
        <div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">CLICK TO PIN IN THE SIDEBAR</div>
      ) : null}
    </HoverStatCard>
  );
}

export { PickHoverCard };
