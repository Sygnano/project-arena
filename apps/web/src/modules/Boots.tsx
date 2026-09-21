"use client";

import { useState } from "react";
import { ResponsivePie } from "@nivo/pie";
import {
  HoverCardRows,
  HoverCardSection,
  HoverStatCard,
} from "@/components/hover-stat-card";
import type { BootStats, BootsOutcome, BootsStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { tierGradient } from "@/lib/tier-bars";
import { formatCompact } from "@/lib/format";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";
import { formatSignedPoints } from "@/components/delta-cell";
import { isLowSample } from "@/lib/sample";

type Props = {
  boots: BootsStats;
};

type Mode = "bought" | "sold";

function modeValue(boot: BootStats, mode: Mode): number {
  return mode === "bought" ? boot.timesBought : boot.timesSold;
}

/**
 * Boots — a donut of which pair the summoner actually buys, beside a legend
 * ranking all 8 of Arena's boots.
 *
 * The numbers behind it come from timeline purchase/sale events, not from
 * end-of-match inventory (see `BootStats`): Arena players sell their boots
 * off late in a match often enough that `items` alone would badly undercount
 * them — roughly half of this summoner's pairs were sold before the game
 * ended, and about half of their matches finished barefoot. That sell-off is
 * the section's actual story, hence the BOUGHT/SOLD toggle rather than one
 * static chart.
 *
 * Slice color runs down the app's rarity-tier gradient BY RANK (most-bought
 * pair prismatic, least silver) rather than using a categorical palette —
 * the same `tierGradient` ramp the activity calendar and the polar hour
 * chart use, so "brighter = more" reads without a color key.
 */
const OUTCOME_ROWS: { key: keyof BootsStats["outcomes"]; label: string }[] = [
  { key: "keptOn", label: "KEPT THEM ON" },
  { key: "soldOff", label: "FINISHED BAREFOOT" },
  { key: "neverBought", label: "NEVER BOUGHT" },
];

function top3Rate(outcome: BootsOutcome): number {
  return outcome.games > 0 ? (outcome.top3Finishes / outcome.games) * 100 : 0;
}

/**
 * Does selling your boots pay off? One cell per boots outcome with its top 3
 * rate and the difference from this summoner's own rate over the same games.
 * Groups under the sample rule are dimmed and show no difference.
 */
function BootsOutcomeStrip({ outcomes }: { outcomes: BootsStats["outcomes"] }) {
  const all = Object.values(outcomes);
  const games = all.reduce((sum, o) => sum + o.games, 0);
  if (games === 0) return null;
  const baseline =
    (all.reduce((sum, o) => sum + o.top3Finishes, 0) / games) * 100;
  return (
    <div className="mt-4 border-t border-[rgba(200,170,110,.14)] pt-3">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {OUTCOME_ROWS.map(({ key, label }) => {
          const outcome = outcomes[key];
          const low = isLowSample(outcome.games);
          const rate = top3Rate(outcome);
          const delta = rate - baseline;
          return (
            <li
              key={key}
              className="flex items-baseline justify-between gap-3 px-3 py-2"
              style={{
                background: "rgba(240,230,210,.03)",
                boxShadow: "inset 0 0 0 1px rgba(200,170,110,.14)",
                opacity: low ? 0.45 : 1,
              }}
            >
              <div className="min-w-0">
                <div className="text-[11px] tracking-[.2em] text-lol-text-secondary">
                  {label}
                </div>
                <div className="mt-0.5 text-[11px] tracking-[.14em] text-lol-text-muted">
                  {outcome.games.toLocaleString()} GAMES
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-[20px] leading-none text-lol-gold-50 tabular-nums">
                  {outcome.games > 0 ? `${rate.toFixed(0)}%` : "—"}
                </div>
                <div
                  className={
                    low || Math.abs(delta) < 1
                      ? "mt-1 text-[11px] text-lol-text-muted tabular-nums"
                      : delta > 0
                        ? "mt-1 text-[11px] text-[#0ae0cf] tabular-nums"
                        : "mt-1 text-[11px] text-lol-garnet tabular-nums"
                  }
                >
                  {low ? "FEW GAMES" : formatSignedPoints(delta, 0)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const Boots = ({ boots }: Props) => {
  const [mode, setMode] = useState<Mode>("bought");
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  const ranked = [...boots.boots].sort(
    (a, b) => modeValue(b, mode) - modeValue(a, mode) || a.itemId - b.itemId,
  );
  // A pair never bought (or, in SOLD mode, never sold) has no slice to draw —
  // it stays in the legend below, dimmed, the same treatment MetaAugments
  // gives a never-picked augment.
  const sliced = ranked.filter((boot) => modeValue(boot, mode) > 0);
  const total = sliced.reduce((sum, boot) => sum + modeValue(boot, mode), 0);

  const colorById = new Map(
    sliced.map((boot, rank) => [
      boot.itemId,
      tierGradient(sliced.length <= 1 ? 1 : 1 - rank / (sliced.length - 1)),
    ]),
  );

  // The legend's bars scale against the LEADER, not against the total —
  // the donut beside them already shows each pair's share of the whole, and
  // at 8 slices a share-width bar leaves even the top pair at under a third
  // of its track, which reads as "nobody buys these" rather than as a
  // ranking.
  const leaderValue = sliced.length > 0 ? modeValue(sliced[0], mode) : 0;

  const focused =
    ranked.find((boot) => boot.itemId === hoveredId) ?? sliced[0] ?? null;
  const focusedValue = focused ? modeValue(focused, mode) : 0;
  const focusedShare = total > 0 ? (focusedValue / total) * 100 : 0;

  const modeNoun = mode === "bought" ? "BOUGHT" : "SOLD";
  const trackedGames = Object.values(boots.outcomes).reduce(
    (sum, o) => sum + o.games,
    0,
  );
  const ofGames = (count: number) =>
    trackedGames > 0
      ? `${count.toLocaleString()} · ${Math.round((count / trackedGames) * 100)}%`
      : count.toLocaleString();


  return (
    <CategorySection
      title="BOOTS"
      quote="Time to out-trot my awkwardness!"
      imageUrl={SECTION_BACKGROUNDS.boots}
      sidebar={
        <>
          <Dial
            value={boots.totalBought}
            label="PAIRS BOUGHT"
            formatValue={(v) => v.toLocaleString()}
          />

          <div className="mt-auto">

            <SidebarStatRows
              size="compact"
              rows={[
                {
                  label: "PAIRS SOLD",
                  value: boots.totalSold.toLocaleString(),
                },
                {
                  label: "GOLD SPENT",
                  value: formatCompact(boots.goldSpent),
                },
                {
                  label: "BAREFOOT FINISHES",
                  value: ofGames(boots.matchesFinishedBarefoot),
                },
                {
                  label: "GAMES WITH NO BUY",
                  value: ofGames(boots.matchesWithoutBoots),
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
            // `mostBoughtInOneMatch` is a purchase stat — there's no sale
            // equivalent, so the clause is dropped rather than mislabeled
            // when the SOLD tab is active.
            mode === "bought"
              ? `${total.toLocaleString()} PAIRS ${modeNoun} · UP TO ${boots.mostBoughtInOneMatch} IN ONE GAME`
              : `${total.toLocaleString()} PAIRS ${modeNoun} · ${boots.totalBought.toLocaleString()} BOUGHT IN TOTAL`
          }
        >
          <DiamondTabs
            tabs={[
              { key: "bought", label: "BOUGHT" },
              { key: "sold", label: "SOLD" },
            ]}
            active={mode}
            onChange={setMode}
          />
        </PanelToolbar>

        <div className="flex min-h-0 flex-1 flex-col items-stretch gap-6 overflow-y-auto lg:flex-row lg:items-center lg:gap-10 lg:overflow-visible">
          <div className="relative min-h-[260px] min-w-0 flex-1 lg:h-full lg:min-h-0">
            {total > 0 ? (
              <ResponsivePie
                data={sliced.map((boot) => ({
                  id: String(boot.itemId),
                  label: boot.itemName,
                  value: modeValue(boot, mode),
                }))}
                margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
                innerRadius={0.62}
                padAngle={1.2}
                cornerRadius={2}
                activeOuterRadiusOffset={10}
                colors={(d) => colorById.get(Number(d.id)) ?? "#b9c4c8"}
                borderWidth={1}
                borderColor="rgba(4,12,20,.85)"
                enableArcLinkLabels={false}
                arcLabelsSkipAngle={18}
                arcLabelsTextColor="#040c14"
                arcLabel={(d) => d.value.toLocaleString()}
                onMouseEnter={(d) => setHoveredId(Number(d.id))}
                onMouseLeave={() => setHoveredId(null)}
                tooltip={({ datum }) => {
                  const boot = ranked.find(
                    (b) => String(b.itemId) === String(datum.id),
                  );
                  if (!boot) return null;
                  return (
                    <HoverStatCard
                      title={
                        <span className="flex items-center gap-2.5">
                          <img
                            src={boot.iconUrl}
                            alt=""
                            className="size-8 flex-none border border-[rgba(200,170,110,.4)]"
                          />
                          <span className="whitespace-normal leading-tight">
                            {boot.itemName}
                          </span>
                        </span>
                      }
                      subtitle={
                        <span className="mt-1.5 block">
                          {total > 0
                            ? ((datum.value / total) * 100).toFixed(0)
                            : 0}
                          % of pairs {modeNoun.toLowerCase()}
                        </span>
                      }
                    >
                      <HoverCardSection>
                        <HoverCardRows
                          rows={[
                            {
                              label: "BOUGHT",
                              value: boot.timesBought.toLocaleString(),
                            },
                            {
                              label: "SOLD",
                              value: boot.timesSold.toLocaleString(),
                            },
                            {
                              label: "SELL RATE",
                              value:
                                boot.timesBought > 0
                                  ? `${Math.round((boot.timesSold / boot.timesBought) * 100)}% of pairs`
                                  : "—",
                            },
                          ]}
                        />
                      </HoverCardSection>
                    </HoverStatCard>
                  );
                }}
                theme={{
                  text: { fontSize: 12 },
                  labels: { text: { fontWeight: 600 } },
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-lol-text-muted">
                No boots {modeNoun.toLowerCase()} yet.
              </div>
            )}

            {/* The donut's hole — a read-out of whichever pair is hovered,
              falling back to the leader. `pointer-events-none` so it never
              steals the hover it is reporting on. */}
            {focused ? (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <img
                  loading="lazy"
                  decoding="async"
                  src={focused.iconUrl}
                  alt={focused.itemName}
                  width={44}
                  height={44}
                  className="border border-[rgba(200,170,110,.6)]"
                />
                <div className="font-display mt-2.5 text-[34px] leading-none text-lol-gold-50">
                  {focusedValue.toLocaleString()}
                </div>
                <div className="mt-1 max-w-40 text-center text-[11px] tracking-[.2em] text-lol-text-muted">
                  {focused.itemName.toUpperCase()}
                </div>
                <div className="mt-1 text-[11px] tracking-[.24em] text-lol-blue-300">
                  {focusedShare.toFixed(0)}% OF PAIRS
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex w-full flex-none flex-col gap-1 lg:w-96">
            {ranked.map((boot) => {
              const value = modeValue(boot, mode);
              const share = total > 0 ? (value / total) * 100 : 0;
              const color = colorById.get(boot.itemId);
              const isFocused = focused?.itemId === boot.itemId;
              return (
                <div
                  key={boot.itemId}
                  tabIndex={0}
                  aria-label={`${boot.itemName}: ${value} ${modeNoun.toLowerCase()}, ${share.toFixed(0)}% of pairs`}
                  onMouseEnter={() => setHoveredId(boot.itemId)}
                  onMouseLeave={() => setHoveredId(null)}
                  onFocus={() => setHoveredId(boot.itemId)}
                  onBlur={() => setHoveredId(null)}
                  className="flex items-center gap-3 px-2 py-1.5 transition-colors duration-150"
                  style={{
                    opacity: value > 0 ? 1 : 0.38,
                    background: isFocused
                      ? "rgba(200,170,110,.09)"
                      : "transparent",
                    boxShadow: isFocused
                      ? "inset 0 0 0 1px rgba(200,170,110,.45)"
                      : undefined,
                  }}
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={boot.iconUrl}
                    alt={boot.itemName}
                    width={32}
                    height={32}
                    className="flex-none border border-[rgba(200,170,110,.45)]"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] tracking-[.06em] text-lol-text-secondary">
                      {boot.itemName}
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full"
                      style={{ background: "rgba(240,230,210,.05)" }}
                    >
                      <div
                        className="h-full transition-[width] duration-300 ease-out"
                        style={{
                          width: `${leaderValue > 0 ? (value / leaderValue) * 100 : 0}%`,
                          background: color ?? "rgba(240,230,210,.12)",
                          boxShadow: color ? `0 0 10px ${color}` : undefined,
                        }}
                      />
                    </div>
                  </div>
                  <div className="w-16 flex-none text-right">
                    <div className="font-display text-[19px] leading-none text-lol-gold-50">
                      {value.toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] tracking-[.14em] text-lol-text-muted">
                      {share.toFixed(0)}%
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <BootsOutcomeStrip outcomes={boots.outcomes} />
      </HextechPanel>
    </CategorySection>
  );
};

export { Boots };
