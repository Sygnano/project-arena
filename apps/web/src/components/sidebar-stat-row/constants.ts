import type { Size } from "./types";

const SIZE_CLASSES: Record<Size, { row: string; label: string; value: string }> = {
  default: {
    row: "gap-3.5 px-1 py-3.25",
    label: "text-sm",
    value: "text-[22px]",
  },
  compact: {
    row: "gap-3.5 px-1 py-2.75",
    label: "text-[13.5px]",
    value: "text-[21px]",
  },
};

export { SIZE_CLASSES };
