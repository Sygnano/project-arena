"use client";

import type { EconomyStats } from "@arena/types";
import { AnimatedNumber } from "@/components/animated-number";
import { CategorySection } from "@/components/category-section";
import { Dial } from "@/components/dial";
import { HextechPanel } from "@/components/hextech-panel";
import { ItemMedallion } from "@/components/item-medallion";
import { RatePair } from "@/components/rate-pair";
import { SidebarStatRows } from "@/components/sidebar-stat-row";
import { formatGold } from "@/lib/format";
import { SECTION_BACKGROUNDS } from "@/lib/section-backgrounds";

type Props = {
  economy: EconomyStats;
  baseline: { top3Rate: number; top1Rate: number };
};

/** Radii (px) of the faint concentric rings behind the medallion. */
const RINGS = [190, 270, 370, 490];
/** Tick-mark dial hugging the medallion. */
const TICKS = 72;
const TICK_RADIUS = 150;

/**
 * Anvils — the Stat anvils (`220000`) the summoner bought, with the gold that
 * went into them. Legendary and Prismatic anvils are item purchases in all
 * but name, so they live in the Vault. The panel's centrepiece is the
 * Shardblade, the stat-shard upgrade, with how the matches holding it ended.
 */
const Anvils = ({ economy, baseline }: Props) => {
  const { anvils, anvilGoldSpent, shardblade } = economy;
  const rate = (count: number) => (shardblade.timesPicked > 0 ? (count / shardblade.timesPicked) * 100 : null);

  return (
    <CategorySection
      title="ANVILS"
      quote="The unrighteous will burn!"
      imageUrl={SECTION_BACKGROUNDS.anvils}
      sidebar={
        <>
          <Dial value={anvils.stat} label="STAT ANVILS BOUGHT" formatValue={(v) => Math.round(v).toLocaleString()} />
          <div className="mt-auto">
            <SidebarStatRows
              size="compact"
              rows={[
                {
                  label: "MOST IN ONE GAME",
                  value: economy.mostStatAnvilsInOneMatch.toLocaleString(),
                },
                {
                  label: "GOLD SPENT",
                  value: `${formatGold(anvilGoldSpent.stat)} · ${
                    economy.totalGoldEarned > 0 ? Math.round((anvilGoldSpent.stat / economy.totalGoldEarned) * 100) : 0
                  }% OF GOLD`,
                },
              ]}
            />
          </div>
        </>
      }
    >
      <HextechPanel title="THE SHARDBLADE" bodyClassName="p-0 overflow-hidden">
        <div className="relative flex h-full min-h-0 flex-col items-center justify-center px-6 py-10">
          <div className="relative">
            {/* Backdrop: glow + rings + tick dial, centred on the medallion. */}
            <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-0 w-0">
              <div
                className="absolute top-0 left-0 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(200,170,110,.17), rgba(10,200,185,.05) 38%, transparent 68%)",
                }}
              />
              <svg
                viewBox="0 0 1000 1000"
                className="absolute top-0 left-0 h-[1000px] w-[1000px] -translate-x-1/2 -translate-y-1/2"
              >
                {RINGS.map((r, i) => (
                  <circle
                    key={r}
                    cx="500"
                    cy="500"
                    r={r}
                    fill="none"
                    stroke={i === 1 ? "rgba(10,200,185,.22)" : "rgba(200,170,110,.16)"}
                    strokeDasharray={i % 2 ? "2 6" : undefined}
                  />
                ))}
                <g className="welcome-spin-slow" style={{ transformOrigin: "500px 500px" }}>
                  {Array.from({ length: TICKS }, (_, i) => {
                    const a = (i / TICKS) * Math.PI * 2;
                    const long = i % 6 === 0;
                    const r2 = TICK_RADIUS + (long ? 20 : 10);
                    // Rounded: server and browser trig can differ in the last
                    // floating-point digits, which broke hydration.
                    const at = (radius: number, fn: (x: number) => number, sign: number) =>
                      Math.round((500 + sign * fn(a) * radius) * 100) / 100;
                    return (
                      <line
                        key={i}
                        x1={at(TICK_RADIUS, Math.sin, 1)}
                        y1={at(TICK_RADIUS, Math.cos, -1)}
                        x2={at(r2, Math.sin, 1)}
                        y2={at(r2, Math.cos, -1)}
                        stroke={long ? "rgba(200,170,110,.6)" : "rgba(200,170,110,.28)"}
                        strokeWidth={long ? 1.5 : 1}
                      />
                    );
                  })}
                </g>
              </svg>
            </div>
            <ItemMedallion iconUrl={shardblade.iconUrl} alt={shardblade.itemName} size={220} glow={0.32} />
          </div>

          <AnimatedNumber
            value={shardblade.timesPicked}
            className="relative mt-8 font-display text-[clamp(56px,7vw,80px)] leading-none text-lol-gold-50 [text-shadow:0_0_34px_rgba(200,170,110,.35)]"
          />
          <div className="relative mt-2 text-[11px] tracking-[.26em] text-lol-text-muted">OBTAINED</div>
          <div
            aria-hidden
            className="relative mt-5 h-px w-full max-w-[420px]"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(200,170,110,.5) 30%, rgba(200,170,110,.5) 70%, transparent)",
            }}
          />
          <RatePair
            className="relative mt-5"
            left={{
              label: "WINRATE",
              value: rate(shardblade.top3),
              baseline: baseline.top3Rate,
              sample: shardblade.timesPicked,
            }}
            right={{
              label: "1ST RATE",
              value: rate(shardblade.top1),
              highlight: true,
              baseline: baseline.top1Rate,
              sample: shardblade.timesPicked,
            }}
          />
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { Anvils };
