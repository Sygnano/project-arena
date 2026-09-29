import type { AugmentFramedCardStats } from "@/features/recap/components/augment-framed-card/types";
import { AugmentStatBlock } from "./components/augment-stat-block";

function AugmentStatsRow({ augment }: { augment: AugmentFramedCardStats }) {
  const wonCount = augment.top1 + augment.top3ExclTop1;
  const divider = "h-[15cqw] w-px bg-[rgba(200,170,110,.3)]";
  return (
    <div className="flex flex-1 items-end gap-[4.5cqw] pb-[22cqw]">
      <AugmentStatBlock value={augment.timesPicked} label="PICKED" />
      <div className={divider} />
      <AugmentStatBlock value={wonCount} label="WINS" />
      <div className={divider} />
      <AugmentStatBlock value={augment.top1} label="1ST" />
    </div>
  );
}

export { AugmentStatsRow };
