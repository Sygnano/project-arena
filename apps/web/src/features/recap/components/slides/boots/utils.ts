import type { BootStats } from "@arena/types";
import type { Mode } from "./types";

function modeValue(boot: BootStats, mode: Mode): number {
  return mode === "bought" ? boot.timesBought : boot.timesSold;
}

export { modeValue };
