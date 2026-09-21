"use client";

import { useMemo, useRef, useState } from "react";
import { ResponsiveChord } from "@nivo/chord";
import type {
  ArcTooltipComponentProps,
  RibbonTooltipComponentProps,
} from "@nivo/chord";
import type { TeammateChampionStats, TeamSynergyStats } from "@arena/types";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { DeltaCell, formatSignedPoints } from "@/components/delta-cell";
import {
  HoverCardChampions,
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/components/hover-stat-card";
import { MIN_SAMPLE, isLowSample, sortByRate } from "@/lib/sample";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { DetailBand } from "@/components/detail-band";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { championIconUrl } from "@/lib/riot";
import { tierGradient } from "@/lib/tier-bars";
import { useChampionName } from "@/lib/champion-names";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { useDragScroll } from "@/hooks/use-drag-scroll";

type Props = TeamSynergyStats & {
  /** The summoner's overall winrate (0-100), for the "vs average" column. */
  baselineTop3Rate: number;
};

type View = "chart" | "picks";
type PickSort = "games" | "top3";

function top3RateOf(row: TeammateChampionStats): number {
  return ((row.top1 + row.top3ExclTop1) / row.games) * 100;
}

const PICK_GRID = "32px minmax(0,1fr) 64px 76px 76px";

/**
 * Champions your teammates played, with how you finished in those games.
 * The chord chart shows who shares a team; this list shows which of those
 * teammates' picks go with better or worse results for you.
 */
function TeammatePicks({
  rows,
  baselineTop3Rate,
  sort,
  mixLowSample,
}: {
  rows: TeammateChampionStats[];
  baselineTop3Rate: number;
  sort: PickSort;
  /** BEST WINRATE: rank pairs under MIN_SAMPLE games with the rest (still dimmed). */
  mixLowSample: boolean;
}) {
  const displayName = useChampionName();
  const listRef = useRef<HTMLUListElement>(null);
  useDragScroll(listRef, "y");
  const sorted =
    sort === "games"
      ? rows
      : sortByRate(
          rows,
          top3RateOf,
          (row) => row.games,
          "desc",
          mixLowSample ? "mixed" : "after",
        );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className="grid items-center gap-3 border-b border-[rgba(200,170,110,.2)] pb-2 text-[11px] tracking-[.2em] text-[#a09b8c]"
        style={{ gridTemplateColumns: PICK_GRID }}
      >
        <div />
        <div>TEAMMATE CHAMPION</div>
        <div className="text-right">GAMES</div>
        <div className="text-right">WINRATE</div>
        <div
          className="text-right"
          title="Your winrate in these games minus your overall winrate"
        >
          VS AVG
        </div>
      </div>
      <ul ref={listRef} className="min-h-0 flex-1 overflow-y-auto">
        {sorted.map((row) => {
          const rate = top3RateOf(row);
          // MOST GAMES ranks by the count itself, so no row is flagged as low-sample.
          const low = sort !== "games" && isLowSample(row.games);
          return (
            <li
              key={row.championId}
              className="grid items-center gap-3 border-b border-[rgba(200,170,110,.08)] py-1.5"
              style={{
                gridTemplateColumns: PICK_GRID,
                opacity: low ? 0.45 : 1,
              }}
              aria-label={`${displayName(row.championName)} on your team: ${row.games} games, your winrate ${rate.toFixed(0)}%`}
            >
              <img
                loading="lazy"
                decoding="async"
                src={championIconUrl(row.championName)}
                alt=""
                width={28}
                height={28}
                className="border border-[rgba(200,170,110,.45)]"
              />
              <div className="truncate text-sm text-lol-text-secondary">
                {displayName(row.championName)}
              </div>
              <div className="font-display text-right text-[15px] text-lol-gold-50 tabular-nums">
                {row.games}
              </div>
              <div className="font-display text-right text-[15px] text-lol-gold-50 tabular-nums">
                {rate.toFixed(0)}%
              </div>
              {low ? (
                <div className="text-right text-[11px] text-lol-text-muted">
                  —
                </div>
              ) : (
                <DeltaCell delta={rate - baselineTop3Rate} />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Team Synergy — a Nivo chord diagram (https://nivo.rocks/chord/) of every
 * champion that has shared the tracked summoner's Arena team, ribbon width
 * showing how many tracked matches any two of them spent on the same team
 * together (own picks included, not just teammates'). Arc color reuses the
 * same silver->gold->prismatic `tierGradient` every other ranked bar in the
 * app uses (see `lib/tier-bars.ts`), scaled against this chart's own
 * champion range rather than `gamesTierPosition`'s day-level thresholds (see
 * `maxGamesOnTeam` below). Champions past the API's per-arc cap are folded
 * into one aggregate "Other" node rather than dropped, so every champion
 * the summoner has ever teamed with is represented somewhere on the chart.
 * Clicking an arc doesn't
 * change the chart itself (Nivo's own hover state already highlights a
 * champion's connections) — it drives the `DetailBand` below, the same
 * "select a row, see its detail readout" pattern as KDA/Utility.
 */
const TeamSynergy = ({
  champions,
  matrix,
  matrixTop1,
  matrixTop3,
  totalDistinctChampions,
  totalDistinctPairings,
  mostPlayedPairing,
  bestPairing,
  teammateChampions,
  baselineTop3Rate,
}: Props) => {
  const [view, setView] = useState<View>("chart");
  // Teammate Picks' sort lives here so its tabs share the panel's toolbar row.
  const [pickSort, setPickSort] = useState<PickSort>("games");
  const [mixLowSample, setMixLowSample] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => champions[0]?.championId ?? null,
  );

  const selectedIndex = champions.findIndex(
    (c) => c.championId === selectedChampionId,
  );
  const selected = selectedIndex >= 0 ? champions[selectedIndex] : null;

  // The selected champion's most-played partner — the highest cell in that
  // champion's row, read straight off the same matrix driving the chart
  // rather than a second lookup structure.
  const topPartner = useMemo(() => {
    if (selectedIndex < 0) return null;
    let bestIndex = -1;
    let bestGames = 0;
    matrix[selectedIndex].forEach((games, index) => {
      // The aggregate "Other" node isn't a partner anyone can act on.
      if (
        index !== selectedIndex &&
        champions[index].championCount === 1 &&
        games > bestGames
      ) {
        bestGames = games;
        bestIndex = index;
      }
    });
    return bestIndex >= 0
      ? { champion: champions[bestIndex], games: bestGames }
      : null;
  }, [selectedIndex, matrix, champions]);

  const displayName = useChampionName();
  const championByName = useMemo(
    () => new Map(champions.map((c) => [c.championName, c])),
    [champions],
  );

  // `gamesTierPosition` was tuned for a single DAY's game count (prismatic
  // at 10+) — reused as-is here, every arc in a well-tracked account
  // saturates to the exact same top-tier color, since a champion easily
  // clears 10 games across a whole season. Rescale against this chart's own
  // range instead, so arc color still reads as "who's been on the team
  // most" (`champions` is already sorted descending by `gamesOnTeam`, so the
  // first entry is the max).
  const maxGamesOnTeam = Math.max(1, champions[0]?.gamesOnTeam ?? 1);

  // Champions past the API's per-arc cap are folded into one aggregate
  // "Other" node (`championCount > 1`) rather than dropped — flagging that
  // here so the caption below can say so, rather than silently showing a
  // partial-looking roster.
  const otherNode = champions.find((c) => c.championCount > 1);
  const namedChampionCount = champions.length - (otherNode ? 1 : 0);

  const indexByName = new Map(
    champions.map((c, index) => [c.championName, index]),
  );

  /** Win/1st rows for a set of shared games, against the summoner's overall
   * winrate — the question this chart answers is "better or worse with". */
  function outcomeRows(games: number, top3: number, top1: number) {
    const winRate = games > 0 ? (top3 / games) * 100 : 0;
    return [
      {
        label: "WINRATE",
        value: (
          <>
            {winRate.toFixed(0)}%
            <span className="ml-1.5 text-[11px] text-lol-text-muted">
              {isLowSample(games)
                ? "few games"
                : formatSignedPoints(winRate - baselineTop3Rate)}
            </span>
          </>
        ),
      },
      {
        label: "1ST RATE",
        value: `${games > 0 ? ((top1 / games) * 100).toFixed(0) : 0}%`,
      },
    ];
  }

  function championIcon(name: string) {
    return (
      <img
        src={championIconUrl(name)}
        alt=""
        className="size-8 flex-none border border-[rgba(200,170,110,.4)]"
      />
    );
  }

  function ArcTooltip({ arc }: ArcTooltipComponentProps) {
    const index = indexByName.get(String(arc.id)) ?? -1;
    const node = champions[index];
    if (!node) return null;
    const isOther = node.championCount > 1;
    let partnerIndex = -1;
    matrix[index].forEach((games, other) => {
      if (
        other !== index &&
        champions[other].championCount === 1 &&
        games > (matrix[index][partnerIndex] ?? 0)
      ) {
        partnerIndex = other;
      }
    });
    const partner = champions[partnerIndex];
    return (
      <HoverStatCard
        title={
          <span className="flex items-center gap-2.5">
            {isOther ? null : championIcon(node.championName)}
            {isOther
              ? `OTHER · ${node.championCount} CHAMPIONS`
              : displayName(node.championName)}
          </span>
        }
        meta={`${node.gamesOnTeam.toLocaleString()} game${node.gamesOnTeam === 1 ? "" : "s"}`}
        subtitle="On your team, you included"
      >
        <HoverCardSection>
          <HoverCardRows
            rows={outcomeRows(
              node.gamesOnTeam,
              node.top3OnTeam ?? 0,
              node.top1OnTeam ?? 0,
            )}
          />
        </HoverCardSection>
        {partner ? (
          <HoverCardSection label="MOST OFTEN WITH">
            <HoverCardChampions
              champions={[
                {
                  championName: partner.championName,
                  games: matrix[index][partnerIndex],
                },
              ]}
            />
          </HoverCardSection>
        ) : null}
        <div className="mt-2.5 text-[10px] tracking-[.2em] text-lol-text-muted/70">
          CLICK TO PIN BELOW
        </div>
      </HoverStatCard>
    );
  }

  function RibbonTooltip({ ribbon }: RibbonTooltipComponentProps) {
    const i = indexByName.get(String(ribbon.source.id)) ?? -1;
    const j = indexByName.get(String(ribbon.target.id)) ?? -1;
    if (i === -1 || j === -1) return null;
    const games = matrix[i][j];
    const nameOf = (index: number) =>
      champions[index].championCount > 1
        ? "Other"
        : displayName(champions[index].championName);
    return (
      <HoverStatCard
        title={
          <span className="flex items-center gap-1.5">
            {champions[i].championCount === 1
              ? championIcon(champions[i].championName)
              : null}
            {champions[j].championCount === 1
              ? championIcon(champions[j].championName)
              : null}
          </span>
        }
        meta={`${games.toLocaleString()} game${games === 1 ? "" : "s"} together`}
        subtitle={`${nameOf(i)} + ${nameOf(j)}`}
      >
        <HoverCardSection>
          <HoverCardRows
            rows={outcomeRows(
              games,
              matrixTop3?.[i]?.[j] ?? 0,
              matrixTop1?.[i]?.[j] ?? 0,
            )}
          />
        </HoverCardSection>
      </HoverStatCard>
    );
  }


  return (
    <CategorySection
      title="SYNERGY"
      quote="I carry these souls to their end... wherever it may be."
      imageUrl={SECTION_BACKGROUNDS.teamSynergy}
      sidebar={
        <>
          <Dial
            value={bestPairing?.top3Rate ?? 0}
            label="BEST PAIR · WINRATE"
            formatValue={(v) => `${v.toFixed(0)}%`}
          />

          <div className="mt-auto">

            <SidebarStatRows
              rows={[
                {
                  label: "CHAMPIONS TEAMED WITH",
                  value: totalDistinctChampions,
                },
                {
                  label: "BEST PAIR",
                  value: bestPairing
                    ? `${displayName(bestPairing.championAName)} + ${displayName(bestPairing.championBName)} · ${bestPairing.gamesTogether}G`
                    : "—",
                },
                { label: "PAIRS FORMED", value: totalDistinctPairings },
                {
                  label: mostPlayedPairing
                    ? `MOST PLAYED · ${displayName(mostPlayedPairing.championAName)} + ${displayName(mostPlayedPairing.championBName)}`.toUpperCase()
                    : "MOST PLAYED PAIR",
                  value: mostPlayedPairing?.gamesTogether ?? 0,
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <PanelToolbar
          caption={
            view === "chart"
              ? `${
                  otherNode
                    ? `TOP ${namedChampionCount} CHAMPIONS + OTHER (${otherNode.championCount})`
                    : "CHAMPIONS SHARING A TEAM"
                } · CLICK AN ARC TO INSPECT`
              : pickSort === "games"
                ? "SEEN TWICE OR MORE"
                : `SEEN TWICE OR MORE · UNDER ${MIN_SAMPLE} GAMES DIMMED`
          }
          trailing={
            view === "picks" && pickSort !== "games" ? (
              <LowSampleSwitch
                checked={mixLowSample}
                onChange={setMixLowSample}
              />
            ) : null
          }
        >
          <DiamondTabs
            tabs={[
              { key: "chart", label: "WHO SHARES A TEAM" },
              { key: "picks", label: "TEAMMATE PICKS" },
            ]}
            active={view}
            onChange={setView}
          />
          {view === "picks" ? (
            <>
              <ToolbarDivider />
              <DiamondTabs
                tabs={[
                  { key: "games", label: "MOST GAMES" },
                  { key: "top3", label: "BEST WINRATE" },
                ]}
                active={pickSort}
                onChange={setPickSort}
              />
            </>
          ) : null}
        </PanelToolbar>

        {view === "picks" ? (
          teammateChampions.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
              No teammate champion seen twice yet.
            </div>
          ) : (
            <TeammatePicks
              rows={teammateChampions}
              baselineTop3Rate={baselineTop3Rate}
              sort={pickSort}
              mixLowSample={mixLowSample}
            />
          )
        ) : champions.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div className="min-h-0 flex-1">
            <ResponsiveChord
              data={matrix}
              keys={champions.map((c) => c.championName)}
              label={(arc) => displayName(String(arc.id))}
              margin={{ top: 60, right: 70, bottom: 60, left: 70 }}
              padAngle={0.02}
              innerRadiusRatio={0.85}
              innerRadiusOffset={0.02}
              arcOpacity={1}
              activeArcOpacity={1}
              inactiveArcOpacity={0.25}
              arcBorderWidth={1}
              arcBorderColor={{ from: "color", modifiers: [["darker", 0.6]] }}
              ribbonOpacity={0.6}
              activeRibbonOpacity={0.85}
              inactiveRibbonOpacity={0.08}
              ribbonBorderWidth={1}
              ribbonBorderColor={{
                from: "color",
                modifiers: [["darker", 0.6]],
              }}
              colors={(d) =>
                tierGradient(
                  (championByName.get(d.id)?.gamesOnTeam ?? 0) / maxGamesOnTeam,
                )
              }
              labelRotation={-90}
              labelOffset={14}
              enableLabel
              onArcClick={(arc) => {
                const node = championByName.get(arc.id ?? arc.label);
                setSelectedChampionId(node?.championId ?? null);
              }}
              arcTooltip={ArcTooltip}
              ribbonTooltip={RibbonTooltip}
              theme={{
                text: { fill: "var(--color-lol-text-muted)", fontSize: 11 },
                labels: {
                  text: { fill: "var(--color-lol-gold-50)", fontSize: 11 },
                },
              }}
            />
          </div>
        )}

        {view === "chart" && selected ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                {selected.championCount > 1 ? (
                  <div
                    className="font-display flex h-15.5 w-15.5 items-center justify-center border border-[rgba(200,170,110,.6)] bg-[rgba(200,170,110,.08)] text-lg text-lol-gold-50"
                    aria-label="Other champions"
                  >
                    +{selected.championCount}
                  </div>
                ) : (
                  <img
                    loading="lazy"
                    decoding="async"
                    src={championIconUrl(selected.championName)}
                    alt=""
                    width={62}
                    height={62}
                    className="block border border-[rgba(200,170,110,.6)] object-cover"
                  />
                )}
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
            title={
              selected.championCount > 1
                ? "OTHER CHAMPIONS"
                : displayName(selected.championName)
            }
            subtitle={
              selected.championCount > 1
                ? `${selected.championCount} CHAMPIONS · ${selected.gamesOnTeam.toLocaleString()} GAMES`
                : `${selected.gamesOnTeam.toLocaleString()} GAMES ON TEAM`
            }
            stats={[
              {
                label: "TOP PARTNER",
                value: topPartner
                  ? displayName(topPartner.champion.championName)
                  : "—",
                highlight: true,
                bordered: false,
              },
              {
                label: "GAMES TOGETHER",
                value: (topPartner?.games ?? 0).toLocaleString(),
              },
            ]}
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export { TeamSynergy };
