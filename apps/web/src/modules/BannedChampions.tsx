"use client";

import { useMemo, useState } from "react";
import { cn } from "cn";
import type { BannedChampionsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { TIER_STYLE, tierForBanRate } from "@/lib/tier-bars";
import { championIconUrl } from "@/lib/riot";

type Props = {
  bannedChampions: BannedChampionsStats;
  /** The summoner's own top3-finish rate, used as the rail's baseline — the
   * same "win" definition `winRateWhenNotBanned` uses (see CLAUDE.md §2 and
   * `BannedChampionStats`'s doc comment), so they must come from the same
   * source or the rail lies. */
  top3Finishes: number;
  matchesPlayed: number;
};

type BanSort = "rate" | "swing";

const SWING_CLAMP = 108;
const SWING_PX_PER_POINT = 17;

function formatSignedPercent(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta).toFixed(1)}%`;
}

/** "count | pct%" sidebar value, laid out as fixed-width grid columns rather
 * than one string — right-aligning free text puts the "|" at a different x
 * position per row whenever the count/percent digit counts differ. Fixed
 * columns keep the "|" on the same vertical line across rows. */
function CountPercentValue({ count, total }: { count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div
      className="grid items-baseline font-display text-[22px] text-lol-gold-50"
      style={{ gridTemplateColumns: "48px 4px 72px" }}
    >
      <span className="text-left tabular-nums">{count.toLocaleString()}</span>
      <span className="text-center text-lol-text-muted">|</span>
      <span className="text-right tabular-nums">{pct.toFixed(1)}%</span>
    </div>
  );
}

const BannedChampions = ({
  bannedChampions,
  top3Finishes,
  matchesPlayed,
}: Props) => {
  const [sort, setSort] = useState<BanSort>("rate");
  const champions = bannedChampions.champions;

  const baseline = matchesPlayed > 0 ? (top3Finishes / matchesPlayed) * 100 : 0;

  // Ban-rate rank is fixed per champion regardless of the active tab's sort
  // — it's "ranked by size" (see design_handoff_arena_panels/README.md,
  // "the tier-fill system"), not by whatever order BIGGEST SWING puts rows
  // in.
  const byBanRate = useMemo(
    () => [...champions].sort((a, b) => b.banRate - a.banRate),
    [champions],
  );
  const banRateRank = useMemo(
    () => new Map(byBanRate.map((c, i) => [c.championId, i])),
    [byBanRate],
  );

  const sorted = useMemo(() => {
    if (sort === "rate") return byBanRate;
    return [...champions].sort((a, b) => {
      const deltaA =
        a.winRateWhenNotBanned == null
          ? -Infinity
          : Math.abs(a.winRateWhenNotBanned - baseline);
      const deltaB =
        b.winRateWhenNotBanned == null
          ? -Infinity
          : Math.abs(b.winRateWhenNotBanned - baseline);
      return deltaB - deltaA;
    });
  }, [champions, byBanRate, sort, baseline]);

  const rows = sorted;

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => rows[0]?.championId ?? null,
  );
  const selected =
    champions.find((c) => c.championId === selectedChampionId) ??
    rows[0] ??
    null;

  const fullyBanned = champions.filter(
    (c) => c.winRateWhenNotBanned == null,
  ).length;

  const modeCaption =
    sort === "rate" ? "SORTED · BY BAN RATE" : "SORTED · BY SWING VS BASELINE";

  return (
    <CategorySection
      title="BANS"
      quote="More of a dog person, huh?"
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel="DAMAGE"
      sidebar={
        <>
          <Dial
            value={bannedChampions.totalBans}
            label="TOTAL BANS"
            formatValue={(v) => v.toLocaleString()}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                {
                  label: "NO BAN",
                  value: (
                    <CountPercentValue
                      count={bannedChampions.noBanCount}
                      total={bannedChampions.totalBans}
                    />
                  ),
                },
                {
                  label: "DUPLICATE BAN",
                  value: (
                    <CountPercentValue
                      count={bannedChampions.duplicateBanCount}
                      total={bannedChampions.totalBans}
                    />
                  ),
                },
                { label: "FULLY BANNED", value: fullyBanned.toLocaleString() },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <div className="mb-3.5 flex items-center gap-6">
          <DiamondTabs
            tabs={[
              { key: "rate", label: "MOST BANNED" },
              { key: "swing", label: "BIGGEST SWING" },
            ]}
            active={sort}
            onChange={setSort}
          />
          <div
            className="h-px flex-1"
            style={{
              background:
                "linear-gradient(90deg, rgba(200,170,110,.28), transparent)",
            }}
          />
          <div className="text-[11px] tracking-[.28em] text-lol-text-muted">
            {modeCaption}
          </div>
        </div>

        <div
          className="grid items-center gap-4 pb-2"
          style={{
            gridTemplateColumns: "36px 104px minmax(0,1fr) 240px 62px",
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <div className="text-[9.5px] tracking-[.22em] text-[#7f7a6e]">
            CHAMPION
          </div>
          <div className="text-[9.5px] tracking-[.22em] text-[#7f7a6e]">
            BAN RATE
          </div>
          <div className="flex items-center justify-between text-[9.5px] tracking-[.18em] text-[#7f7a6e]">
            <span className="text-lol-garnet">◀ WORSE</span>
            <span>BASELINE</span>
            <span className="text-lol-blue-300">BETTER ▶</span>
          </div>
          <div className="text-right text-[9.5px] tracking-[.22em] text-[#7f7a6e]">
            WIN %
          </div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col justify-start gap-0.75 overflow-y-auto py-1.5 pr-1"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(200,170,110,.45) transparent",
          }}
        >
          {rows.map((champion) => {
            const tier = TIER_STYLE[tierForBanRate(champion.banRate)];
            const isSelected = champion.championId === selectedChampionId;
            const winRate = champion.winRateWhenNotBanned;
            const delta = winRate == null ? null : winRate - baseline;
            const dotLeft =
              delta == null
                ? 120
                : 120 +
                  Math.max(
                    -SWING_CLAMP,
                    Math.min(SWING_CLAMP, delta * SWING_PX_PER_POINT),
                  );
            const dotColor =
              delta == null
                ? "transparent"
                : delta >= 0
                  ? "#0ae0cf"
                  : "var(--color-lol-garnet)";

            return (
              <div
                key={champion.championId}
                onClick={() => setSelectedChampionId(champion.championId)}
                className="grid cursor-pointer items-center gap-4 px-1.5 py-1.25 transition-colors duration-150"
                style={{
                  gridTemplateColumns: "36px 104px minmax(0,1fr) 240px 62px",
                  background: isSelected
                    ? "rgba(200,170,110,.09)"
                    : "transparent",
                  boxShadow: isSelected
                    ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                    : undefined,
                }}
              >
                <div className={cn("h-9 w-9 overflow-hidden")}>
                  <img
                    src={championIconUrl(champion.championName)}
                    alt={champion.championName}
                    width={36}
                    height={36}
                    className="h-full w-full "
                  />
                </div>

                <div className="font-body truncate text-[16px] text-lol-gold-50">
                  {champion.championName}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="relative h-3 flex-1 min-w-0"
                    style={{ background: "rgba(240,230,210,.05)" }}
                  >
                    <div
                      className={cn("h-3", tier.fillClass)}
                      style={{
                        width: `${champion.banRate}%`,
                        borderTop: `1px solid ${tier.edge}`,
                        boxShadow: tier.glow,
                      }}
                    />
                  </div>
                  <div className="w-10 flex-none font-display text-[15px] text-lol-text-secondary">
                    {champion.banRate.toFixed(0)}%
                  </div>
                </div>

                <div className="relative h-5.5 w-60">
                  <div
                    className="absolute inset-x-0"
                    style={{
                      top: 11,
                      height: 1,
                      background: "rgba(240,230,210,.07)",
                    }}
                  />
                  <div
                    className="absolute"
                    style={{
                      left: 120,
                      top: 2,
                      width: 1,
                      height: 18,
                      background: "rgba(200,170,110,.45)",
                    }}
                  />
                  {delta != null ? (
                    <div
                      className="absolute"
                      style={{
                        top: 11,
                        height: 1,
                        left: Math.min(120, dotLeft),
                        width: Math.abs(dotLeft - 120),
                        background: dotColor,
                      }}
                    />
                  ) : null}
                  <div
                    className="absolute h-1.75 w-1.75 rotate-45 transition-[left] duration-250 ease-in-out"
                    style={{
                      left: dotLeft - 3.5,
                      top: 8,
                      background: dotColor,
                      opacity: delta == null ? 0 : 1,
                    }}
                  />
                </div>

                <div className="text-right font-display text-[16px] text-lol-text-secondary">
                  {winRate == null ? (
                    <span className="text-lol-text-disabled">—</span>
                  ) : (
                    `${winRate.toFixed(0)}%`
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-[10.5px] leading-relaxed text-lol-text-muted tracking-[.26em]">
          <span className="text-lol-garnet">◀ WORSE THAN BASELINE</span>: : YOUR
          WINRATE DECREASE IF OPS TAKE THE CHAMP |{" "}
          <span className="text-lol-blue-300">BETTER THAN BASELINE ▶</span>:
          YOUR WINRATE INCREASE IF OPS TAKE THE CHAMP
        </div>

        {selected ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  src={championIconUrl(selected.championName)}
                  alt={selected.championName}
                  width={62}
                  height={62}
                  className="block border border-[rgba(200,170,110,.6)] object-cover"
                />
                <div
                  className="absolute -top-1.25 -left-1.25 h-2.25 w-2.25 rotate-45 bg-[#040c14]"
                  style={{ border: "1px solid rgba(200,170,110,.8)" }}
                />
                <div
                  className="absolute -right-1.25 -bottom-1.25 h-2.25 w-2.25 rotate-45 bg-[#040c14]"
                  style={{ border: "1px solid rgba(200,170,110,.8)" }}
                />
              </div>
            }
            title={selected.championName}
            subtitle={`${selected.totalBans.toLocaleString()} BANS`}
            stats={[
              {
                label: "BAN RATE",
                value: `${selected.banRate.toFixed(0)}%`,
                highlight: true,
                bordered: false,
              },
              {
                label: "BAN RANK",
                value: `#${(banRateRank.get(selected.championId) ?? 0) + 1}`,
              },
              {
                label: "TIMES AVAILABLE",
                value: `${Math.round(
                  matchesPlayed * (1 - selected.banRate / 100),
                ).toLocaleString()}`,
                nowrap: true,
              },
              {
                label: "WIN WHEN OPEN",
                value:
                  selected.winRateWhenNotBanned == null
                    ? "—"
                    : `${selected.winRateWhenNotBanned.toFixed(0)}%`,
                nowrap: true,
              },
              {
                label: "VS BASELINE",
                value:
                  selected.winRateWhenNotBanned == null
                    ? "—"
                    : formatSignedPercent(
                        selected.winRateWhenNotBanned - baseline,
                      ),
                nowrap: true,
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { BannedChampions };
