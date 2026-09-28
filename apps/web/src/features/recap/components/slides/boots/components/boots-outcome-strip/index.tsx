"use client";

import type { BootsStats } from "@arena/types";
import { formatSignedPoints } from "@/components/delta-cell";
import { isLowSample } from "@/features/recap/utils/sample";
import { OUTCOME_ROWS } from "./constants";
import { top3Rate } from "./utils";

/**
 * Does selling your boots pay off? One cell per boots outcome with its top 3
 * rate and the difference from this summoner's own rate over the same games.
 * Groups under the sample rule are dimmed and show no difference.
 */
function BootsOutcomeStrip({ outcomes }: { outcomes: BootsStats["outcomes"] }) {
  const all = Object.values(outcomes);
  const games = all.reduce((sum, o) => sum + o.games, 0);
  if (games === 0) return null;
  const baseline = (all.reduce((sum, o) => sum + o.top3Finishes, 0) / games) * 100;
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
                <div className="text-[11px] tracking-[.2em] text-lol-text-secondary">{label}</div>
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

export { BootsOutcomeStrip };
