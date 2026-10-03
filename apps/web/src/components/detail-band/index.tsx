import type { ReactNode } from "react";
import { StatCell } from "./components/stat-cell";
import type { Stat } from "./types";

type Props = {
  /** Icon / image rendered on the left (36×36 or similar). */
  icon: ReactNode;
  /** Primary content next to the icon (e.g. champion name, or a custom
   * multi-line node like TimePlayed's stacked month/day label). */
  title: ReactNode;
  /** Secondary text below the title (e.g. "12 GAMES"). */
  subtitle?: string;
  /** Link or button under the subtitle (e.g. a `DossierLink`). */
  action?: ReactNode;
  /** Stat cells displayed to the right. */
  stats: Stat[];
  /** Grid column template for the stats row — override when the default
   * even-split doesn't fit (e.g. some columns need more room). */
  statsGrid?: string;
};

/**
 * A horizontal detail strip — icon + title/subtitle on the left, a row of
 * stat cells on the right. Used below charts (KDA's champion detail,
 * champion stats, etc.) to show a summary for the selected item.
 */
function DetailBand({ icon, title, subtitle, action, stats, statsGrid }: Props) {
  return (
    // Laid out by the PANEL's width (a container query), not the viewport's:
    // the same band sits in panels from ~500px to ~1300px wide. Below 64rem
    // the identity block stacks over the stats and the stat cells wrap; at
    // 64rem and up they sit side by side in fixed columns. A viewport
    // breakpoint here let 7 stat cells overlap in a 1366px-wide window.
    <div className="@container mt-2 pt-4.5" style={{ borderTop: "1px solid rgba(200,170,110,.28)" }}>
      <div className="grid items-center gap-x-6.5 gap-y-3 @5xl:grid-cols-[240px_minmax(0,1fr)]">
        <div className="flex min-w-0 items-center gap-4">
          {icon}
          <div className="min-w-0">
            <div className="font-display truncate text-[22px] tracking-[.06em] text-lol-gold-50">{title}</div>
            {subtitle ? <div className="mt-1 text-xs tracking-[.22em] text-[#a09b8c]">{subtitle}</div> : null}
            {action ? <div className="mt-1.5">{action}</div> : null}
          </div>
        </div>

        <div
          className="flex flex-wrap gap-y-3 @5xl:grid"
          style={{
            gridTemplateColumns: statsGrid ?? `repeat(${stats.length},minmax(0,1fr))`,
          }}
        >
          {stats.map((stat, i) => (
            <StatCell
              key={stat.label}
              label={stat.label}
              value={stat.value}
              highlight={stat.highlight}
              bordered={i > 0 ? stat.bordered !== false : stat.bordered}
              nowrap={stat.nowrap}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export type { Stat } from "./types";
export { DetailBand };
