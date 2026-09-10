import type { FunStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { StatGrid } from "@/components/stat-grid";

type Props = FunStats;

const Fun = ({ totalFistBumps, totalPings, totalSkillshotsDodged }: Props) => (
  <CategorySection title="Fun Stats">
    <StatGrid
      className="w-full max-w-lg"
      stats={[
        ["Fist Bumps", totalFistBumps],
        ["Total Pings", totalPings],
        ["Skillshots Dodged", totalSkillshotsDodged],
      ]}
    />
  </CategorySection>
);

export { Fun };
