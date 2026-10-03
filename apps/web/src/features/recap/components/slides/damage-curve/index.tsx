"use client";

import type { DamageCurve as Curve, DamageCurveStats } from "@arena/types";
import { cn } from "cn";
import { useMemo, useRef, useState } from "react";
import { Dial } from "@/components/dial";
import { DiamondTabs } from "@/components/diamond-tabs";
import { HextechPanel } from "@/components/hextech-panel";
import { PanelToolbar } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-rows";
import { CategorySection } from "@/features/recap/components/category-section";
import { LowSampleSwitch } from "@/features/recap/components/low-sample-switch";
import { useChampionName } from "@/features/recap/stores/champion-names";
import { DAMAGE_TYPE_COLORS, DAMAGE_TYPE_KEYS, DAMAGE_TYPE_LABELS } from "@/features/recap/utils/damage-types";
import { isLowSample, MIN_SAMPLE, sortByRate } from "@/features/recap/utils/sample";
import { SECTION_BACKGROUNDS } from "@/features/recap/utils/section-backgrounds";
import { useDragScroll } from "@/hooks/use-drag-scroll";
import { pressable } from "@/utils/a11y";
import { ordinal } from "@/utils/format";
import { championIconUrl } from "@/utils/riot";
import { CurveChart } from "./components/curve-chart";
import { LIST_ICON_SIZE, MODE_LABEL } from "./constants";
import { useWheelForwardsTo } from "./hooks";
import type { Mode, Selection } from "./types";
import { curveDamage, findings, formatDamage, formatMinutes, toPoints } from "./utils";

type Props = {
  damageCurves: DamageCurveStats;
};

/**
 * Damage Curve — how damage to champions piles up over a match, minute by
 * minute, for every game or one champion's. TOTAL stacks every game's curve
 * into the season's (it ends at the season's damage total), AVERAGE divides
 * that by the games, BEST GAME is the single highest-damage game. Games that
 * ended keep their final total, so TOTAL and AVERAGE flatten as matches end.
 */
const DamageCurve = ({ damageCurves }: Props) => {
  const displayName = useChampionName();
  const [mode, setMode] = useState<Mode>("total");
  const [selection, setSelection] = useState<Selection>("all");
  // AVERAGE: rank champions under MIN_SAMPLE games with the rest (still dimmed).
  const [mixLowSample, setMixLowSample] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  useDragScroll(listRef, "y");
  // The wheel anywhere on the panel (over the chart too) scrolls the list.
  const panelRef = useRef<HTMLDivElement>(null);
  useWheelForwardsTo(panelRef, listRef);

  const { all, champions } = damageCurves;
  const sortedChampions = useMemo(
    () =>
      mode === "average"
        ? sortByRate(
            champions,
            (c) => curveDamage(c, mode),
            (c) => c.games,
            "desc",
            mixLowSample ? "mixed" : "after",
          )
        : [...champions].sort((a, b) => curveDamage(b, mode) - curveDamage(a, mode)),
    [champions, mode, mixLowSample],
  );
  // BEST GAME has no "all champions" row (its best game is just the top
  // champion's), so an "all" selection shows the top champion there and
  // comes back when switching to another mode.
  const activeSelection: Selection =
    mode === "best" && selection === "all" ? (sortedChampions[0]?.championId ?? "all") : selection;
  const selectedChampion =
    activeSelection === "all" ? null : (champions.find((c) => c.championId === activeSelection) ?? null);
  const curve: Curve | null = selectedChampion ?? all;

  const points = useMemo(() => {
    if (!curve) return [];
    if (mode === "best") return toPoints(curve.bestGame.series);
    return toPoints(curve.total, mode === "average" ? curve.games : 1);
  }, [curve, mode]);

  const facts = useMemo(() => findings(points), [points]);

  if (!curve || points.length === 0) {
    return (
      <CategorySection title="DMG CURVE" imageUrl={SECTION_BACKGROUNDS.damageCurve}>
        <HextechPanel>
          <div className="flex h-full items-center justify-center text-sm text-lol-text-muted">
            No match timelines yet.
          </div>
        </HextechPanel>
      </CategorySection>
    );
  }

  const best = curve.bestGame;
  const bestLastMinute = best.series.physical.length - 1;
  const outMinute =
    mode === "best" && best.timePlayedSeconds / 60 < bestLastMinute - 0.5 ? best.timePlayedSeconds / 60 : null;

  const selectionName = selectedChampion ? displayName(selectedChampion.championName).toUpperCase() : "ALL CHAMPIONS";
  const caption =
    mode === "best"
      ? `BEST GAME · ${displayName(best.championName).toUpperCase()} · ${ordinal(best.placement).toUpperCase()} · ${formatDamage(facts.final)} DMG`
      : `${selectionName} · ${curve.games} GAMES · ENDED GAMES HOLD THEIR FINAL TOTAL`;

  const listRow = (key: Selection, icon: React.ReactNode, name: string, games: number, damage: number) => {
    const isSelected = activeSelection === key;
    return (
      <div
        key={key}
        {...pressable(() => setSelection(key), { pressed: isSelected })}
        aria-label={`${name}, ${games} games`}
        className={cn(
          "flex h-12 flex-none cursor-pointer items-center gap-2.5 px-1.5 transition-[background,opacity] duration-150 hover:bg-[rgba(200,170,110,.05)]",
          mode === "average" && key !== "all" && isLowSample(games) && "opacity-45",
        )}
        style={{
          background: isSelected ? "rgba(200,170,110,.09)" : undefined,
          boxShadow: isSelected ? "inset 0 0 0 1px rgba(200,170,110,.45)" : undefined,
        }}
      >
        {icon}
        <div className="min-w-0 flex-1">
          <div className="truncate font-body text-[14px] leading-tight text-lol-gold-50">{name}</div>
          <div className="mt-0.5 text-[10px] tracking-[.18em] text-lol-text-muted">
            {games} {games === 1 ? "GAME" : "GAMES"}
          </div>
        </div>
        <div className="flex-none font-display text-[15px] text-lol-gold-100 tabular-nums">{formatDamage(damage)}</div>
      </div>
    );
  };

  return (
    <CategorySection
      title="DMG CURVE"
      quote="Five day forecast: sunshine, rainbows and bloodshed!"
      imageUrl={SECTION_BACKGROUNDS.damageCurve}
      sidebar={
        <>
          <Dial
            value={facts.final}
            label={mode === "total" ? "TOTAL DMG" : mode === "average" ? "AVG DMG" : "BEST GAME DMG"}
            labelPosition="bottom"
            formatValue={formatDamage}
          />

          <div className="mt-auto">
            <SidebarStatRows
              rows={[
                {
                  label: "BY MINUTE 10",
                  value: formatDamage(facts.byMinute10),
                },
                {
                  label: "BY MINUTE 20",
                  value: formatDamage(facts.byMinute20),
                },
                {
                  label: "BIGGEST MINUTE",
                  value: (
                    <span className="whitespace-nowrap">
                      {formatDamage(facts.peak.dealt)}
                      <span className="ml-2 text-[15px] text-lol-text-muted">
                        {facts.peak.minute - 1}&prime;&ndash;{facts.peak.minute}
                        &prime;
                      </span>
                    </span>
                  ),
                },
                {
                  label: "HALF DEALT BY",
                  value: formatMinutes(facts.halfMinute),
                },
              ]}
            />
          </div>
        </>
      }
    >
      <div ref={panelRef} className="contents">
        <HextechPanel contentMinWidth={720}>
          <PanelToolbar
            caption={
              mode === "average" && activeSelection !== "all" && isLowSample(curve.games)
                ? `${caption} · UNDER ${MIN_SAMPLE} GAMES`
                : caption
            }
            captionKey={`${mode}-${activeSelection}`}
            trailing={mode === "average" ? <LowSampleSwitch checked={mixLowSample} onChange={setMixLowSample} /> : null}
          >
            <DiamondTabs
              tabs={(["total", "average", "best"] as const).map((key) => ({
                key,
                label: MODE_LABEL[key],
              }))}
              active={mode}
              onChange={setMode}
            />
          </PanelToolbar>

          <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)] gap-5 pt-2">
            <div
              ref={listRef}
              className="flex min-h-0 flex-col gap-0.75 overflow-y-auto pr-1"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "rgba(200,170,110,.45) transparent",
              }}
            >
              {mode !== "best" && all
                ? listRow(
                    "all",
                    <div
                      className="grid flex-none place-items-center border border-[rgba(200,170,110,.5)] font-display text-[11px] text-lol-gold-100"
                      style={{ width: LIST_ICON_SIZE, height: LIST_ICON_SIZE }}
                    >
                      ALL
                    </div>,
                    "All champions",
                    all.games,
                    curveDamage(all, mode),
                  )
                : null}
              {sortedChampions.map((champion) =>
                listRow(
                  champion.championId,
                  <img
                    loading="lazy"
                    decoding="async"
                    src={championIconUrl(champion.championName)}
                    alt=""
                    width={LIST_ICON_SIZE}
                    height={LIST_ICON_SIZE}
                    className="flex-none"
                  />,
                  displayName(champion.championName),
                  champion.games,
                  curveDamage(champion, mode),
                ),
              )}
            </div>

            <div className="flex min-h-0 flex-col">
              <div className="mb-1 flex flex-none items-center gap-5 pl-14">
                {DAMAGE_TYPE_KEYS.map((key) => (
                  <div
                    key={key}
                    className="flex items-center gap-2 text-[11px] tracking-[.2em] text-lol-text-secondary"
                  >
                    <span className="size-2.5 rotate-45" style={{ background: DAMAGE_TYPE_COLORS[key] }} />
                    {DAMAGE_TYPE_LABELS[key]}
                  </div>
                ))}
              </div>
              <div className="min-h-0 flex-1">
                <CurveChart points={points} animationKey={`${mode}-${activeSelection}`} outMinute={outMinute} />
              </div>
            </div>
          </div>
        </HextechPanel>
      </div>
    </CategorySection>
  );
};

export { DamageCurve };
