"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "cn";
import type { EconomyStats, ItemOutcomeStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { DetailBand } from "@/components/detail-band";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { HextechPanel } from "@/components/hextech-panel";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { SortHeaderLabel } from "@/components/sortable-stat-row";
import { formatSignedPoints } from "@/components/delta-cell";
import { pressable } from "@/lib/a11y";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { formatGold } from "@/lib/format";
import { LowSampleSwitch } from "@/components/low-sample-switch";
import { MIN_SAMPLE, isLowSample, pooledRate, sortByRate } from "@/lib/sample";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { TIER_STYLE } from "@/lib/tier-bars";

type Props = {
  economy: EconomyStats;
  legendaryItems: ItemOutcomeStats[];
  matchesPlayed: number;
  top3Finishes: number;
};

type Sort = "picks" | "win" | "top1";
type SortDir = "asc" | "desc";

const COLUMNS =
  "36px minmax(140px,220px) minmax(64px,1fr) minmax(130px,190px) minmax(130px,190px)";

const pct = (count: number, total: number) =>
  total > 0 ? (count / total) * 100 : 0;

const itemRate = (item: ItemOutcomeStats, key: "top3" | "top1") =>
  item.timesPicked > 0 ? item[key] / item.timesPicked : 0;

/** A thin 0-100% rate bar with a tick at the summoner's own overall rate,
 * plus the number. */
function RateBar({
  value,
  baseline,
  color,
}: {
  value: number;
  baseline: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="relative h-1.5 flex-1"
        style={{ background: "rgba(240,230,210,.06)" }}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-300"
          style={{
            width: `${value}%`,
            background: color,
            boxShadow: `0 0 8px ${color}`,
          }}
        />
        <div
          className="absolute -top-1 -bottom-1 w-px"
          style={{ left: `${baseline}%`, background: "rgba(240,230,210,.55)" }}
        />
      </div>
      <div
        className="w-11 flex-none text-right font-display text-[16px]"
        style={{
          color:
            value >= baseline
              ? "var(--color-lol-gold-50)"
              : "var(--color-lol-text-muted)",
        }}
      >
        {value.toFixed(0)}%
      </div>
    </div>
  );
}

/**
 * Vault — the summoner's gold numbers (plus the Legendary and Prismatic
 * anvils, which buy items rather than stats) in the identity column, and a
 * Legendary item breakdown in the panel (Banned Champions' chart layout):
 * how many matches each Legendary was picked in, and the win and
 * top 1 rates of those matches against the summoner's own baseline.
 */
const Vault = ({
  economy,
  legendaryItems,
  matchesPlayed,
  top3Finishes,
}: Props) => {
  const [sort, setSort] = useState<Sort>("picks");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  // Rate sorts: rank items under MIN_SAMPLE picks with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);

  // Clicking the column you're already sorted by flips the direction, the
  // same behaviour as Nemesis' header row.
  const sortBy = (next: Sort) => {
    if (next === sort) {
      setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    } else {
      setSort(next);
      setSortDir("desc");
    }
  };
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");
  // Baseline = the average Legendary build, not the plain per-game rate:
  // longer games build more Legendaries and finish higher (see `pooledRate`).
  const winBaseline = pooledRate(
    legendaryItems,
    (item) => item.top3,
    (item) => item.timesPicked,
  );
  const top1Baseline = pooledRate(
    legendaryItems,
    (item) => item.top1,
    (item) => item.timesPicked,
  );
  const perGameTop3 = pct(top3Finishes, matchesPlayed);

  const pickRank = useMemo(
    () => new Map(legendaryItems.map((item, i) => [item.itemId, i])),
    [legendaryItems],
  );
  const maxPicks = legendaryItems[0]?.timesPicked ?? 0;
  const rateKey = sort === "win" ? "top3" : "top1";
  // Rate sorts grow the main bar by that rate instead of picks, scaled against
  // the best rate among rows with enough picks so a 1-for-1 outlier can't
  // flatten every real bar; mixed in, every row counts (see lib/sample.ts).
  // Outliers above the max clamp to a full bar.
  const maxRate =
    sort === "picks"
      ? 0
      : Math.max(
          0,
          ...legendaryItems
            .filter((item) => mixLowSample || !isLowSample(item.timesPicked))
            .map((item) => itemRate(item, rateKey)),
        );
  const barWidth = (item: ItemOutcomeStats) =>
    sort === "picks"
      ? maxPicks > 0
        ? (item.timesPicked / maxPicks) * 100
        : 0
      : maxRate > 0
        ? (Math.min(itemRate(item, rateKey), maxRate) / maxRate) * 100
        : 0;

  const rows = useMemo(() => {
    if (sort === "picks") {
      // `legendaryItems` already arrives sorted by picks, descending.
      return sortDir === "desc"
        ? legendaryItems
        : [...legendaryItems].reverse();
    }
    const key = sort === "win" ? "top3" : "top1";
    return sortByRate(
      legendaryItems,
      (item) => itemRate(item, key),
      (item) => item.timesPicked,
      sortDir,
      mixLowSample ? "mixed" : "after",
    );
  }, [legendaryItems, sort, sortDir, mixLowSample]);

  const [selectedId, setSelectedId] = useState<number | null>(
    () => legendaryItems[0]?.itemId ?? null,
  );
  const selected =
    legendaryItems.find((item) => item.itemId === selectedId) ??
    rows[0] ??
    null;

  const modeCaption =
    sort === "picks"
      ? "SORTED · BY TIMES PICKED"
      : `SORTED · BY ${sort === "win" ? "WINRATE" : "1ST RATE"} · UNDER ${MIN_SAMPLE} DIMMED`;

  /** Each rate/count column doubles as its sort control. A function call
   * rather than a nested component, so a re-sort doesn't remount the buttons
   * (and drop focus). */
  const sortHeader = (key: Sort, label: string) => (
    <button
      type="button"
      className="cursor-pointer text-left select-none hover:opacity-100"
      style={{ opacity: sort === key ? 1 : 0.55 }}
      onClick={() => sortBy(key)}
    >
      <SortHeaderLabel label={label} active={sort === key} dir={sortDir} />
    </button>
  );


  return (
    <CategorySection
      title="VAULT"
      quote="I've got values - they stack up nicely."
      imageUrl={SECTION_BACKGROUNDS.vault}
      sidebar={
        <>
          <Dial
            value={economy.totalGoldEarned}
            label="GOLD EARNED"
            formatValue={(v) => formatGold(v, economy.totalGoldEarned)}
          />
          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                {
                  label: "MOST IN ONE GAME",
                  value: formatGold(economy.mostGoldInOneGame),
                },
                {
                  label: "ITEMS PURCHASED",
                  value: economy.itemsPurchased.toLocaleString(),
                },
                {
                  label: "CONSUMABLES",
                  value: economy.consumablesPurchased.toLocaleString(),
                },
                {
                  label: "LEGENDARY ANVILS",
                  value: economy.anvils.legendary.toLocaleString(),
                },
                {
                  label: "PRISMATIC ANVILS",
                  value: economy.anvils.prismatic.toLocaleString(),
                  valueColor: "var(--color-augment-prismatic)",
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel contentMinWidth={640}>
        <PanelToolbar
          caption={modeCaption}
          trailing={
            sort !== "picks" ? (
              <LowSampleSwitch
                checked={mixLowSample}
                onChange={setMixLowSample}
                unit="PICKS"
              />
            ) : null
          }
        >
          <DiamondTabs
            tabs={[
              { key: "picks", label: "MOST PICKED" },
              { key: "win", label: "WINRATE" },
              { key: "top1", label: "1ST RATE" },
            ]}
            active={sort}
            onChange={sortBy}
          />
        </PanelToolbar>

        <div
          className="grid items-center gap-4 pb-2 text-[11px] tracking-[.22em] text-[#a09b8c]"
          style={{
            gridTemplateColumns: COLUMNS,
            borderBottom: "1px solid rgba(200,170,110,.16)",
          }}
        >
          <div />
          <div>LEGENDARY ITEM</div>
          {sortHeader("picks", "TIMES PICKED")}
          {sortHeader("win", "WINRATE")}
          {sortHeader("top1", "1ST RATE")}
        </div>

        <div
          ref={listRef}
          className="flex min-h-0 flex-1 flex-col justify-start gap-0.75 overflow-y-auto py-1.5 pr-1"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(200,170,110,.45) transparent",
          }}
        >
          {rows.map((item) => {
            // Fixed-meaning stack: Prismatic = 1st, Gold = 2nd-3rd, Silver =
            // the rest. Under a rate sort it holds only the placements that
            // count toward that rate, so its length is the rate itself — same
            // as `PrismaticItemPicks`.
            const stack = (
              [
                ["1st", item.top1, TIER_STYLE.prismatic],
                ["top3", item.top3 - item.top1, TIER_STYLE.gold],
                ["rest", item.timesPicked - item.top3, TIER_STYLE.silver],
              ] as const
            ).filter(
              ([key]) =>
                sort === "picks" ||
                key === "1st" ||
                (sort === "win" && key === "top3"),
            );
            const stackCount = stack.reduce((sum, [, value]) => sum + value, 0);
            const isSelected = item.itemId === selected?.itemId;
            const lowSample = sort !== "picks" && isLowSample(item.timesPicked);
            return (
              <div
                key={item.itemId}
                {...pressable(() => setSelectedId(item.itemId), {
                  pressed: isSelected,
                })}
                aria-label={`${item.itemName}: built in ${item.timesPicked} games, winrate ${pct(item.top3, item.timesPicked).toFixed(0)}%`}
                className={cn(
                  "grid cursor-pointer items-center gap-4 px-1.5 py-1.25 transition-[background,opacity] duration-150",
                  lowSample && "opacity-45",
                )}
                style={{
                  gridTemplateColumns: COLUMNS,
                  background: isSelected
                    ? "rgba(200,170,110,.09)"
                    : "transparent",
                  boxShadow: isSelected
                    ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                    : undefined,
                }}
              >
                <img
                  loading="lazy"
                  decoding="async"
                  src={item.iconUrl}
                  alt={item.itemName}
                  width={36}
                  height={36}
                  className="h-9 w-9 border border-[rgba(200,170,110,.25)]"
                />
                <div className="font-body truncate text-[16px] text-lol-gold-50">
                  {item.itemName}
                </div>

                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="relative h-3 min-w-0 flex-1"
                    style={{ background: "rgba(240,230,210,.05)" }}
                  >
                    <div
                      className="flex h-3 transition-[width] duration-500 ease-out"
                      style={{ width: `${barWidth(item)}%` }}
                    >
                      {stack.map(([key, value, tier]) =>
                        value > 0 ? (
                          <div
                            key={key}
                            className={cn("h-3 min-w-px", tier.fillClass)}
                            style={{
                              flexGrow: value / stackCount,
                              flexBasis: 0,
                              borderTop: `1px solid ${tier.edge}`,
                              boxShadow: tier.glow,
                            }}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                  <div className="w-8 flex-none text-right font-display text-[15px] text-lol-text-secondary">
                    {item.timesPicked}
                  </div>
                </div>

                <RateBar
                  value={pct(item.top3, item.timesPicked)}
                  baseline={winBaseline}
                  color="rgba(10,200,185,.85)"
                />
                <RateBar
                  value={pct(item.top1, item.timesPicked)}
                  baseline={top1Baseline}
                  color="rgba(200,170,110,.9)"
                />
              </div>
            );
          })}
        </div>

        <div className="mt-2 text-[11px] tracking-[.26em] text-lol-text-muted">
          <span className="text-lol-gold-50">│</span> TICK = YOUR AVERAGE
          LEGENDARY ({winBaseline.toFixed(0)}% WINRATE). ABOVE YOUR{" "}
          {perGameTop3.toFixed(0)}% PER GAME: LONGER GAMES BUILD MORE ITEMS.
        </div>

        {selected ? (
          <DetailBand
            icon={
              <div className="relative flex-none">
                <img
                  loading="lazy"
                  decoding="async"
                  src={selected.iconUrl}
                  alt={selected.itemName}
                  width={62}
                  height={62}
                  className="block border border-[rgba(200,170,110,.6)]"
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
            title={selected.itemName}
            subtitle={`${selected.timesPicked} PICKS · #${(pickRank.get(selected.itemId) ?? 0) + 1}`}
            stats={[
              {
                label: "PICK RATE",
                value: `${pct(selected.timesPicked, matchesPlayed).toFixed(0)}%`,
                highlight: true,
                bordered: false,
              },
              {
                label: "WINRATE",
                value: `${pct(selected.top3, selected.timesPicked).toFixed(0)}%`,
              },
              {
                label: "WINRATE VS AVG ITEM",
                value: formatSignedPoints(
                  pct(selected.top3, selected.timesPicked) - winBaseline,
                ),
                nowrap: true,
              },
              {
                label: "1ST RATE",
                value: `${pct(selected.top1, selected.timesPicked).toFixed(0)}%`,
              },
              {
                label: "1ST VS AVG ITEM",
                value: formatSignedPoints(
                  pct(selected.top1, selected.timesPicked) - top1Baseline,
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

export { Vault };
