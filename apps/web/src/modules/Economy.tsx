import type { EconomyStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { HextechPanel } from "@/components/hextech-panel";
import { SidebarStatRows } from "@/components/sidebar-stat-row";

type Props = {
  economy: EconomyStats;
  nextSectionLabel?: string;
};

const RINGS = [
  { key: "stat", label: "STAT", r: 124, color: "var(--color-lol-blue-300)" },
  { key: "legendary", label: "LEGENDARY", r: 100, color: "var(--color-lol-gold-300)" },
  { key: "prismatic", label: "PRISMATIC", r: 76, color: "var(--color-lol-mythic)" },
] as const;

// The open gap left at the ring's 12 o'clock (post -90deg rotation) so a
// full ring never reads as a closed circle — see
// design_handoff_arena_panels/README.md, 7c.
const RING_FILL_FACTOR = 0.78;

/**
 * Economy — the repo's anvil donut becomes three concentric gauge rings,
 * each scaled against the single MOST-purchased anvil type (not against
 * their combined total, which is what the old pie's proportions showed) —
 * see design_handoff_arena_panels/README.md, 7c. Gold earned carries the
 * panel as the headline number; the purchase counts sit under it as plain
 * rows instead of competing with the rings for attention.
 */
const Economy = ({ economy, nextSectionLabel = "ABILITY" }: Props) => {
  const goldMillions = economy.totalGoldEarned / 1_000_000;
  const anvilTotal =
    economy.anvils.stat + economy.anvils.legendary + economy.anvils.prismatic;
  const maxAnvil = Math.max(
    1,
    economy.anvils.stat,
    economy.anvils.legendary,
    economy.anvils.prismatic,
  );

  return (
    <CategorySection
      title="ECONOMY"
      quote="Gold is the only thing that never lies."
      imageUrl="/images/kda-bg.jpg"
      nextSectionLabel={nextSectionLabel}
    >
      <HextechPanel
        title="THE VAULT"
        bodyClassName="pt-13 grid grid-cols-[500px_minmax(0,1fr)] gap-14 items-center"
      >
        <div>
          <div className="text-[11.5px] tracking-[.26em] text-lol-text-muted">
            GOLD EARNED
          </div>
          <div className="mt-3.5 flex items-baseline gap-3.5">
            <div
              className="font-display text-[96px] leading-[.9] text-lol-gold-50"
              style={{ textShadow: "0 0 34px rgba(200,155,60,.32)" }}
            >
              {goldMillions.toFixed(2)}
            </div>
            <div className="font-display text-[40px] text-lol-gold-300">M</div>
          </div>
          <div
            className="mt-6.5 h-px w-55"
            style={{
              background: "linear-gradient(90deg, rgba(200,170,110,.55), transparent)",
            }}
          />
          <div className="mt-6.5">
            <SidebarStatRows
              size="compact"
              rows={[
                {
                  label: "MOST IN ONE GAME",
                  value: economy.mostGoldInOneGame.toLocaleString(),
                },
                {
                  label: "ITEMS PURCHASED",
                  value: economy.itemsPurchased.toLocaleString(),
                },
                {
                  label: "CONSUMABLES",
                  value: economy.consumablesPurchased.toLocaleString(),
                },
              ]}
            />
          </div>
        </div>

        <div className="flex items-center justify-center gap-14">
          <div className="relative h-75 w-75 flex-none">
            <svg viewBox="0 0 300 300" className="block h-full w-full -rotate-90">
              {RINGS.map((ring) => (
                <circle
                  key={`${ring.key}-track`}
                  cx="150"
                  cy="150"
                  r={ring.r}
                  fill="none"
                  stroke="rgba(240,230,210,.06)"
                  strokeWidth="13"
                />
              ))}
              {RINGS.map((ring) => {
                const value = economy.anvils[ring.key];
                const circumference = 2 * Math.PI * ring.r;
                const dashOn =
                  (value / maxAnvil) * circumference * RING_FILL_FACTOR;
                return (
                  <circle
                    key={ring.key}
                    cx="150"
                    cy="150"
                    r={ring.r}
                    fill="none"
                    stroke={ring.color}
                    strokeWidth="13"
                    strokeDasharray={`${dashOn} ${circumference}`}
                    opacity=".9"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="font-display text-[52px] leading-none text-lol-gold-50">
                {anvilTotal.toLocaleString()}
              </div>
              <div className="mt-1.5 pl-[.28em] text-[10px] tracking-[.28em] text-lol-text-muted">
                ANVILS
              </div>
            </div>
          </div>

          <div className="flex min-w-55 flex-col gap-0.5">
            {RINGS.map((ring) => (
              <div
                key={ring.key}
                className="flex items-center gap-3.5 py-3.5"
                style={{ borderTop: "1px solid rgba(200,170,110,.14)" }}
              >
                <div
                  className="h-2.25 w-2.25 flex-none rotate-45"
                  style={{ background: ring.color }}
                />
                <div className="flex-1 text-[12.5px] tracking-[.2em] text-lol-text-secondary">
                  {ring.label}
                </div>
                <div className="font-display text-[23px] text-lol-gold-50">
                  {economy.anvils[ring.key].toLocaleString()}
                </div>
              </div>
            ))}
            <div className="h-px" style={{ background: "rgba(200,170,110,.14)" }} />
          </div>
        </div>
      </HextechPanel>
    </CategorySection>
  );
};

export { Economy };
