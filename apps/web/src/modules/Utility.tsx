import type { UtilityStats } from "@arena/types";
import { CategorySection } from "@/components/category-section";
import { StatGrid } from "@/components/stat-grid";

type Props = UtilityStats;

const Utility = ({
  totalHealingAndShielding,
  totalCcScoreSeconds,
  totalCcTimeDealt,
  totalSavesFromDeath,
}: Props) => (
  <CategorySection title="Utility">
    <StatGrid
      className="w-full max-w-2xl"
      stats={[
        ["Healing & Shielding", totalHealingAndShielding],
        ["CC Score", totalCcScoreSeconds],
        ["CC Time Dealt", totalCcTimeDealt],
        ["Saves From Death", totalSavesFromDeath],
      ]}
    />
  </CategorySection>
);

export { Utility };
