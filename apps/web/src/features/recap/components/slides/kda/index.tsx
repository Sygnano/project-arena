"use client";

import type { ChampionStats } from "@arena/types";
import { useMemo, useState } from "react";
import { CursorTooltip } from "@/components/cursor-tooltip";
import { DetailBand } from "@/components/detail-band";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { HextechBarChart } from "@/components/hextech-bar-chart";
import { HextechPanel } from "@/components/hextech-panel";
import { PanelToolbar, ToolbarDivider } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-rows";
import { CategorySection } from "@/features/recap/components/category-section";
import { DossierLink } from "@/features/recap/components/dossier-link";
import { LowSampleSwitch } from "@/features/recap/components/low-sample-switch";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { MIN_SAMPLE } from "@/features/recap/utils/sample";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { useChartHover } from "@/hooks/use-chart-hover";
import { championIconUrl } from "@/utils/riot";
import { KdaHoverCard } from "./components/kda-hover-card";
import { METRIC_LABEL, METRICS } from "./constants";
import type { Metric, Mode } from "./types";
import { buildChartRows, buildRoster, toBarColumns } from "./utils";

type Props = {
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  mostKills: number;
  bestKda: number;
  champions: Record<number, ChampionStats>;
};

/**
 * KDA section — recreated from the Claude Design handoff in
 * `design_handoff_arena_kda/` (option 2a). High-fidelity: a full-bleed
 * blurred arena background, a left identity column (title, KDA dial, K/D/A
 * totals), and a right "instrument panel" holding a horizontally-scrolling
 * per-champion bar chart plus a detail readout for whichever champion is
 * selected. The background/header/bottom-cue chrome lives in
 * `CategorySection` (lifted from this section so later sections can reuse
 * it); this component only owns the identity column's dial/totals
 * (`sidebar`) and the instrument panel itself (`children`).
 */
const KDA = ({ kills, deaths, assists, kda, mostKills, bestKda, champions }: Props) => {
  const [metric, setMetric] = useState<Metric>("kills");
  const [mode, setMode] = useState<Mode>("total");
  // Outside TOTAL: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const displayName = useChampionName();

  const roster = useMemo(() => buildRoster(champions), [champions]);

  const [selectedChampionId, setSelectedChampionId] = useState<number | null>(
    () => buildChartRows(roster, "kills", "perGame", null)[0]?.entry.championId ?? null,
  );

  const chartRows = useMemo(
    () => buildChartRows(roster, metric, mode, selectedChampionId, mixLowSample),
    [roster, metric, mode, selectedChampionId, mixLowSample],
  );

  const barColumns = useMemo(
    () => toBarColumns(chartRows, metric, mode, displayName),
    [chartRows, metric, mode, displayName],
  );

  const { hover, onHover, containerRef: hoverRef } = useChartHover<number>();
  const hoveredIndex = hover ? chartRows.findIndex((row) => row.entry.championId === hover.id) : -1;
  const hoveredRow = hoveredIndex === -1 ? null : chartRows[hoveredIndex];

  const selectedEntry = roster.find((entry) => entry.championId === selectedChampionId) ?? roster[0] ?? null;

  const modeLabel = mode === "perGame" ? "PER GAME" : mode === "total" ? "ALL GAMES" : "BEST SINGLE GAME";
  // Deaths sort ascending outside TOTAL (see `buildChartRows`) — called out
  // as "FEWEST" since lower-is-better is the opposite of every other column.
  const sortLabel = mode !== "total" && metric === "deaths" ? "FEWEST DEATHS" : METRIC_LABEL[metric];
  const modeCaption =
    mode === "total"
      ? `${modeLabel} · BY ${sortLabel}`
      : `${modeLabel} · BY ${sortLabel} · UNDER ${MIN_SAMPLE} GAMES DIMMED`;

  return (
    <CategorySection
      title="KDA"
      quote="Everyone's got a plan, 'til they get slammed into the ground."
      imageUrl={SECTION_BACKGROUNDS.kda}
      sidebar={
        <>
          <Dial value={kda} label="KDA" />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                { label: "KILLS", value: kills.toLocaleString() },
                { label: "DEATHS", value: deaths.toLocaleString() },
                { label: "ASSISTS", value: assists.toLocaleString() },
                { label: "MOST KILLS · 1 GAME", value: mostKills.toLocaleString() },
                { label: "BEST KDA · 1 GAME", value: bestKda.toFixed(1) },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel>
        <PanelToolbar
          caption={modeCaption}
          trailing={mode !== "total" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
        >
          <DiamondTabs
            tabs={[
              { key: "total", label: "TOTAL" },
              { key: "best", label: "BEST GAME" },
              { key: "perGame", label: "PER GAME" },
            ]}
            active={mode}
            onChange={setMode}
          />
          <ToolbarDivider />
          <DiamondTabs
            tabs={METRICS.map((m) => ({ key: m, label: METRIC_LABEL[m] }))}
            active={metric}
            onChange={setMetric}
            gap={18}
          />
        </PanelToolbar>

        {roster.length === 0 ? (
          <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-lol-text-muted">
            No tracked matches yet.
          </div>
        ) : (
          <div ref={hoverRef} className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
            <HextechBarChart
              columns={barColumns}
              onSelect={(id) => setSelectedChampionId(id as number)}
              onHover={onHover}
              highlightedId={hover?.id ?? null}
              heightUnit="percent"
            />
            <CursorTooltip point={hoveredRow && champions[hoveredRow.entry.championId] ? hover!.point : null}>
              {hoveredRow && champions[hoveredRow.entry.championId] ? (
                <KdaHoverCard
                  stats={champions[hoveredRow.entry.championId]}
                  rank={hoveredIndex + 1}
                  total={chartRows.length}
                  sortLabel={sortLabel}
                  modeLabel={modeLabel}
                />
              ) : null}
            </CursorTooltip>
          </div>
        )}

        {selectedEntry ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  loading="lazy"
                  decoding="async"
                  src={championIconUrl(selectedEntry.championName)}
                  alt=""
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
            title={displayName(selectedEntry.championName)}
            action={<DossierLink championId={selectedEntry.championId} />}
            subtitle={`${selectedEntry.games.toLocaleString()} GAMES`}
            stats={[
              {
                label: "KDA",
                value: selectedEntry.kda.toFixed(2),
                highlight: true,
                bordered: false,
              },
              {
                label: "KILLS",
                value: selectedEntry.kills.toLocaleString(),
              },
              {
                label: "DEATHS",
                value: selectedEntry.deaths.toLocaleString(),
              },
              {
                label: "ASSISTS",
                value: selectedEntry.assists.toLocaleString(),
              },
              {
                label: "BEST KDA GAME",
                value: `${selectedEntry.bestKdaLine.kills} / ${selectedEntry.bestKdaLine.deaths} / ${selectedEntry.bestKdaLine.assists}`,
                nowrap: true,
              },
              {
                label: "SOLO KILLS",
                value: selectedEntry.soloKills.toLocaleString(),
                nowrap: true,
              },
              {
                label: "LARGEST SPREE",
                value: selectedEntry.largestKillingSpree.toLocaleString(),
                nowrap: true,
              },
            ]}
            statsGrid="repeat(5,minmax(0,1fr)) 1.5fr 1fr"
          />
        ) : null}
      </HextechPanel>
    </CategorySection>
  );
};

export type { ChampionRosterEntry, ChartRow, Metric, Mode } from "./types";
export { KDA };
