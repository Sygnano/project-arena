type MultikillKey = "double" | "triple" | "quadra" | "penta";

type PlateTier = {
  key: MultikillKey;
  label: string;
  count: number;
  borderColor: string;
  boxShadow: string;
  countColor: string;
  labelColor: string;
  prismatic?: boolean;
};

export type { MultikillKey, PlateTier };
