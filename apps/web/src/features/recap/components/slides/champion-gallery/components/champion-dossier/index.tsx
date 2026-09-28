"use client";

import { useState } from "react";
import type { ChampionPickBreakdown, ChampionStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { DiamondTabs } from "@/components/diamond-tabs";
import { PanelToolbar } from "@/components/panel-toolbar";
import { SidebarStatRows } from "@/components/sidebar-stat-rows";
import { ChampionCard } from "@/features/recap/components/slides/champion-gallery/components/champion-card";
import { CompositionDonut } from "@/features/recap/components/slides/champion-gallery/components/composition-donut";
import { sumDamageBreakdown } from "@/features/recap/utils/damage-types";
import { formatCompact, formatHoursMinutes, formatDuration } from "@/utils/format";
import { FinishesChart } from "./components/finishes-chart";
import { FormChart } from "./components/form-chart";
import { Num } from "./components/num";
import { PickListGroup } from "./components/pick-list-group";
import { PlacementSplitBar } from "./components/placement-split-bar";
import { StatGroup } from "./components/stat-group";
import { StatLine } from "./components/stat-line";
import {
  ANVIL_COLORS,
  CC_COLOR,
  FIRST_RATE_COLOR,
  HEAL_COLOR,
  NO_CASTS,
  NO_DAMAGE,
  SPECIAL_COLOR,
  TOP3_RATE_COLOR,
} from "./constants";
import type { Mode } from "./types";
import { augmentEntries, castSlices, damageSlices, itemEntries, percent, sumCasts } from "./utils";

/**
 * The per-champion drilldown that replaces the gallery when a card is
 * opened — a miniature of the summoner page's own stat sections, scoped to
 * one champion and sized to fit inside a single `HextechPanel`.
 *
 * A TOTAL / BEST GAME switch (the same tabs Damage and Ability use) flips
 * the stat groups and donuts between career sums and single-match records.
 * Text lines in BEST GAME are each independently maxed (the most kills and
 * the most deaths can come from different matches), while each donut shows
 * one real match's split (its `maxGame`), since a composition stitched
 * together from several matches wouldn't describe any game. Finishes and
 * items and recent form don't have a single-match reading and stay the same
 * in both modes.
 *
 * Deliberately covers only what happens in a fight on this champion. Page-
 * level sections that aren't champion-scoped — bans (lobby-wide, with no
 * participant attached, see CLAUDE.md §2), teammates and nemesis (accounts,
 * not champions) and pings — have no meaningful per-champion reading and
 * are left out rather than shown as noise.
 */
function ChampionDossier({
  pick,
  stats,
  rank,
  totalChampions,
}: {
  pick: ChampionPickBreakdown;
  /** Undefined only in the (unreachable in practice) case where a champion
   * has picks but no aggregate row — both come from the same
   * `match_participants` rows. Guarded anyway so a data gap degrades to an
   * empty dossier instead of a crash. */
  stats: ChampionStats | undefined;
  rank: number;
  totalChampions: number;
}) {
  const [mode, setMode] = useState<Mode>("total");
  const best = mode === "best";

  const won = pick.top1 + pick.top3ExclTop1;
  const games = stats?.matchesPlayed ?? pick.timesPicked;
  const kda = stats?.kda;
  const combat = stats?.combat;
  const economy = stats?.economy;
  const utility = best ? stats?.utility.bestByType : stats?.utility.total;

  const careerKda = kda ? (kda.totalKills + kda.totalAssists) / Math.max(1, kda.totalDeaths) : 0;
  const bestGame = kda?.bestGame;
  const bestKda = bestGame ? (bestGame.kills + bestGame.assists) / Math.max(1, bestGame.deaths) : 0;

  const damageDealt = (best ? stats?.damage.maxGame : stats?.damage.total) ?? NO_DAMAGE;
  const damageTaken = (best ? stats?.damageTaken.maxGame : stats?.damageTaken.total) ?? NO_DAMAGE;
  const casts = (best ? stats?.ability.maxGame : stats?.ability.total) ?? NO_CASTS;
  const anvils = best
    ? (economy?.maxGameAnvils ?? { stat: 0, legendary: 0, prismatic: 0 })
    : {
        stat: economy?.statAnvilsBought ?? 0,
        legendary: economy?.legendaryAnvilsBought ?? 0,
        prismatic: economy?.prismaticAnvilsBought ?? 0,
      };

  /** Hole caption for a donut: a per-game average on TOTAL, a plain
   * "ONE GAME" tag on BEST GAME. */
  const perGame = (total: number, format: (value: number) => string) =>
    best ? "ONE GAME" : `${format(games > 0 ? total / games : 0)} / GAME`;
  const compact = (value: number) => formatCompact(Math.round(value));
  const plain = (value: number) => Math.round(value).toLocaleString("en-US");

  const items = stats?.items;

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 md:grid-cols-[236px_minmax(0,1fr)]">
      {/* Identity column — the same card the gallery shows, so opening a
        card reads as that card staying put while the stats arrive beside
        it, rather than switching to an unrelated layout. In deck mode the
        card takes only the height the rows below it leave (a size container
        measuring that slot), so a short viewport shrinks the card instead of
        pushing the rows past the panel. */}
      <div className="mx-auto flex w-full max-w-[236px] flex-col md:max-w-none deck:min-h-0">
        <div className="w-full flex-none deck:min-h-0 deck:flex-1 deck:@container-size">
          <div className="deck:mx-auto deck:w-[min(100cqw,calc(100cqh*155/256))]">
            <ChampionCard champion={pick} interactive={false} />
          </div>
        </div>

        <div className="mt-4 flex-none text-center">
          <div className="text-[11px] tracking-[.24em] text-lol-blue-300">
            #{rank} OF {totalChampions} PICKED
          </div>
        </div>

        <div className="mt-3 flex-none">
          <PlacementSplitBar champion={pick} />
        </div>

        <div className="mt-3 flex-none">
          <SidebarStatRows
            size="compact"
            rows={[
              { label: "GAMES", value: games.toLocaleString("en-US") },
              {
                label: "WINRATE",
                value: percent(won, pick.timesPicked),
                valueColor: TOP3_RATE_COLOR,
              },
              {
                label: "1ST RATE",
                value: percent(pick.top1, pick.timesPicked),
                valueColor: FIRST_RATE_COLOR,
              },
              {
                label: "TIME PLAYED",
                value: formatHoursMinutes(stats?.timePlayedSeconds ?? 0),
              },
            ]}
          />
        </div>
      </div>

      <div className="@container flex min-w-0 flex-col md:min-h-0">
        <PanelToolbar
          className="mb-6 flex-none"
          caption={
            best ? "SINGLE-MATCH RECORDS" : `ACROSS ${games.toLocaleString("en-US")} GAME${games === 1 ? "" : "S"}`
          }
        >
          <DiamondTabs
            tabs={[
              { key: "total", label: "TOTAL" },
              { key: "best", label: "BEST GAME" },
            ]}
            active={mode}
            onChange={setMode}
          />
        </PanelToolbar>

        {/* `content-start` rather than a stretched grid so a short group
          leaves blank space under itself instead of stretching every row
          to match the tallest one — except in deck mode at four columns,
          where the bottom row (finishes, items, augments) takes whatever
          height is left so the grid fills the panel and the lists scroll
          inside it. Every gap is the panel's own 24px padding. Columns kick in earlier than a typical
          card grid (@sm/@lg/@2xl rather than @2xl/@6xl) — at the 1280×860
          deck-mode floor (CLAUDE.md's own minimum test size) the stat area
          is ~776px wide, so @2xl (672px) is what actually reaches 4 columns
          there instead of needing a much wider monitor — so this fits inside
          the panel's single-screen height on realistic window widths instead
          of stacking all ten groups in one column and needing to scroll. */}
        <div className="grid grid-flow-row-dense grid-cols-1 content-start gap-6 @sm:grid-cols-2 @lg:grid-cols-3 @2xl:grid-cols-4 deck:min-h-0 deck:flex-1 deck:@2xl:grid-rows-[auto_auto_minmax(10rem,1fr)]">
          {/* Above Finishes, so the two placement views share a column. */}
          <StatGroup title="FORM" aside={stats ? `${stats.form.games.length} GAMES` : undefined}>
            {stats && stats.form.games.length > 0 ? (
              <FormChart key={stats.championId} form={stats.form} maxPlacement={stats.placementCounts.length} />
            ) : null}
          </StatGroup>

          {/* The four stat groups split the other three columns evenly. */}
          <div className="grid min-w-0 grid-cols-1 gap-6 @sm:col-span-2 @sm:grid-cols-2 @lg:col-span-2 @2xl:col-span-3 @2xl:grid-cols-4">
            <StatGroup title="COMBAT">
              <StatLine label="KILLS" value={<Num value={(best ? kda?.mostKills : kda?.totalKills) ?? 0} />} />
              <StatLine label="DEATHS" value={<Num value={(best ? kda?.mostDeaths : kda?.totalDeaths) ?? 0} />} />
              <StatLine label="ASSISTS" value={<Num value={(best ? kda?.mostAssists : kda?.totalAssists) ?? 0} />} />
              <StatLine
                label="KDA"
                note={best && bestGame ? `${bestGame.kills}/${bestGame.deaths}/${bestGame.assists}` : undefined}
                value={<AnimatedNumber value={best ? bestKda : careerKda} decimals={2} durationMs={700} />}
              />
              <StatLine label="BIGGEST CRIT" value={<Num value={combat?.largestCriticalStrike ?? 0} compact />} />
            </StatGroup>

            <StatGroup title="MULTIKILLS">
              <StatLine
                label="DOUBLE"
                value={<Num value={(best ? combat?.mostDoubleKills : combat?.doubleKills) ?? 0} />}
              />
              <StatLine
                label="TRIPLE"
                value={<Num value={(best ? combat?.mostTripleKills : combat?.tripleKills) ?? 0} />}
              />
              <StatLine
                label="QUADRA"
                value={<Num value={(best ? combat?.mostQuadraKills : combat?.quadraKills) ?? 0} />}
              />
              <StatLine
                label="PENTA"
                value={<Num value={(best ? combat?.mostPentaKills : combat?.pentaKills) ?? 0} />}
              />
              <StatLine label="SOLO KILLS" value={<Num value={(best ? kda?.mostSoloKills : kda?.soloKills) ?? 0} />} />
              <StatLine label="BEST SPREE" value={<Num value={kda?.largestKillingSpree ?? 0} />} />
            </StatGroup>

            <StatGroup title="UTILITY">
              <StatLine
                label="HEAL & SHIELD"
                value={<Num value={utility?.healingAndShielding ?? 0} compact />}
                valueColor={HEAL_COLOR}
              />
              <StatLine
                label="CC SCORE"
                value={<Num value={utility?.ccScoreSeconds ?? 0} compact />}
                valueColor={CC_COLOR}
              />
              <StatLine label="CC TIME DEALT" value={formatDuration(utility?.ccTimeDealt ?? 0)} />
              <StatLine label="SAVES" value={<Num value={utility?.savesFromDeath ?? 0} />} />
              <StatLine
                label="SELF-MITIGATED"
                value={
                  <Num value={(best ? combat?.bestDamageSelfMitigated : combat?.damageSelfMitigated) ?? 0} compact />
                }
              />
            </StatGroup>

            <StatGroup title="ECONOMY">
              <StatLine
                label="GOLD EARNED"
                value={<Num value={(best ? economy?.bestGameGoldEarned : economy?.goldEarned) ?? 0} compact />}
                valueColor="#c8aa6e"
              />
              <StatLine
                label="ITEMS BOUGHT"
                value={<Num value={(best ? economy?.mostItemsPurchased : economy?.itemsPurchased) ?? 0} />}
              />
              <StatLine label="LONGEST GAME" value={formatDuration(stats?.longestGameSeconds ?? 0)} />
            </StatGroup>
          </div>

          <StatGroup title="DAMAGE DEALT">
            <CompositionDonut
              slices={damageSlices(damageDealt)}
              format={compact}
              caption={perGame(sumDamageBreakdown(damageDealt), compact)}
            />
          </StatGroup>

          <StatGroup title="DAMAGE TAKEN">
            <CompositionDonut
              slices={damageSlices(damageTaken)}
              format={compact}
              caption={perGame(sumDamageBreakdown(damageTaken), compact)}
            />
          </StatGroup>

          <StatGroup title="ABILITY CASTS">
            <CompositionDonut slices={castSlices(casts)} format={plain} caption={perGame(sumCasts(casts), plain)} />
          </StatGroup>

          <StatGroup title="ANVILS">
            <CompositionDonut
              slices={[
                {
                  key: "stat",
                  label: "STAT",
                  value: anvils.stat,
                  color: ANVIL_COLORS.stat,
                },
                {
                  key: "legendary",
                  label: "LEGENDARY",
                  value: anvils.legendary,
                  color: ANVIL_COLORS.legendary,
                },
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  value: anvils.prismatic,
                  color: ANVIL_COLORS.prismatic,
                },
              ]}
              format={plain}
              caption={perGame(anvils.stat + anvils.legendary + anvils.prismatic, (v) => v.toFixed(1))}
            />
          </StatGroup>

          {/* First column of the bottom row, under the form chart, with the
            item and augment lists beside it. */}
          <StatGroup title="FINISHES" aside={stats ? `AVG ${stats.avgPlacement.toFixed(2)}` : undefined}>
            <FinishesChart counts={stats?.placementCounts ?? []} />
          </StatGroup>

          {/* Items and augments split the rest of the row evenly. */}
          <div className="grid min-h-0 grid-cols-1 gap-6 @sm:col-span-2 @lg:col-span-3 @lg:grid-cols-2">
            <PickListGroup
              title="ITEMS"
              tabs={[
                {
                  key: "legendary",
                  label: "LEGENDARY",
                  color: ANVIL_COLORS.legendary,
                  rows: itemEntries(items?.legendary),
                  verb: "built",
                  noun: "ITEMS",
                  empty: "NO LEGENDARY ITEMS BUILT",
                },
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  color: ANVIL_COLORS.prismatic,
                  rows: itemEntries(items?.prismatic),
                  verb: "held at the end",
                  noun: "ITEMS",
                  empty: "NO PRISMATIC ITEMS HELD",
                },
                {
                  key: "special",
                  label: "SPECIAL",
                  color: SPECIAL_COLOR,
                  rows: itemEntries(items?.special),
                  verb: "held at the end",
                  noun: "ITEMS",
                  empty: "NO SPECIAL ITEMS HELD",
                },
                {
                  key: "boots",
                  label: "BOOTS",
                  color: ANVIL_COLORS.stat,
                  rows: itemEntries(items?.boots),
                  verb: "bought",
                  noun: "BOOTS",
                  empty: "NEVER BOUGHT BOOTS",
                },
              ]}
            />
            <PickListGroup
              title="AUGMENTS"
              round
              tabs={[
                {
                  key: "prismatic",
                  label: "PRISMATIC",
                  color: ANVIL_COLORS.prismatic,
                  rows: augmentEntries(stats?.augments, 2),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO PRISMATIC AUGMENTS PICKED",
                },
                {
                  key: "gold",
                  label: "GOLD",
                  color: ANVIL_COLORS.legendary,
                  rows: augmentEntries(stats?.augments, 1),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO GOLD AUGMENTS PICKED",
                },
                {
                  key: "silver",
                  label: "SILVER",
                  color: ANVIL_COLORS.stat,
                  rows: augmentEntries(stats?.augments, 0),
                  verb: "picked",
                  noun: "AUGMENTS",
                  empty: "NO SILVER AUGMENTS PICKED",
                },
              ]}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export { ChampionDossier };
