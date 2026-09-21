"use client";

import { cn } from "cn";
import { HextechSwitch } from "@/components/hextech-switch";
import { MIN_SAMPLE } from "@/lib/sample";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What the sample counts, for the label: "GAMES", "PICKS"... */
  unit?: string;
  /** The size of the DiamondTabs the switch shares a row with. Those tabs
   * reserve space under their labels for the active underline; the same
   * margin under the switch lines it up with the labels. A margin rather than
   * an offset, because the panel's scroll box clips anything shifted out of
   * the row. */
  alignWith?: "md" | "sm";
};

/**
 * The "show low pickrate" toggle for any list that ranks rows under `MIN_SAMPLE`
 * after the rest (`sortByRate`). On: every row is ranked together, low-sample
 * rows still dimmed. Render it only while such a sort is active, as a
 * `PanelToolbar`'s `trailing` — the toolbar slides it in and out.
 */
function LowSampleSwitch({ checked, onChange, unit = "GAMES", alignWith = "md" }: Props) {
  return (
    <div className={cn(alignWith === "md" ? "mb-2" : "mb-1.25")}>
      <HextechSwitch
        checked={checked}
        onChange={onChange}
        label="SHOW LOW PICKRATE"
        title={
          checked
            ? `Rows under ${MIN_SAMPLE} ${unit.toLowerCase()} are ranked together with the rest (still dimmed)`
            : `Rows under ${MIN_SAMPLE} ${unit.toLowerCase()} are ranked after the rest — switch on to rank everyone together`
        }
      />
    </div>
  );
}

export { LowSampleSwitch };
