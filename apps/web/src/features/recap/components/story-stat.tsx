"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import { AnimatedNumber } from "@/components/animated-number";
import { Appear } from "@/components/appear";

type Props = {
  value: number;
  label: ReactNode;
  /** Formats the counting value (a percent, a duration...). */
  format?: (value: number) => string;
  decimals?: number;
  size?: "xl" | "lg" | "md";
  /** Number color: pale gold by default; `win` (a winrate, top 3) is tier
   * gold and `first` (1st places) tier prismatic, as everywhere on the page;
   * `accent` is a cyan highlight. */
  tone?: "gold" | "win" | "first" | "accent" | "danger";
  delay?: number;
  className?: string;
};

const SIZE = {
  xl: "text-[clamp(52px,min(10vw,14vh),128px)]",
  lg: "text-[clamp(38px,min(6.4vw,10vh),84px)]",
  md: "text-[clamp(30px,4vw,52px)]",
} as const;

const TONE = {
  gold: "text-lol-gold-50 [text-shadow:0_0_48px_rgba(200,170,110,.35)]",
  win: "text-[#e6c27a] [text-shadow:0_0_48px_rgba(200,155,60,.45)]",
  first:
    "bg-[linear-gradient(120deg,#f0b8dc,#c9a0ec_40%,#9fc4ef_75%,#a8e0cf)] bg-clip-text text-transparent [filter:drop-shadow(0_0_22px_rgba(185,138,221,.45))]",
  accent: "text-lol-blue-100 [text-shadow:0_0_48px_rgba(10,200,185,.4)]",
  danger: "text-[#ffb3bd] [text-shadow:0_0_48px_rgba(232,64,87,.4)]",
} as const;

/** A story slide's big number, counting up, over its small caps label. */
function StoryStat({ value, label, format, decimals, size = "lg", tone = "gold", delay = 0.4, className }: Props) {
  return (
    <Appear delay={delay} from="scale" className={className}>
      <AnimatedNumber
        value={value}
        format={format}
        decimals={decimals}
        className={cn("block font-display leading-none tracking-[.02em]", SIZE[size], TONE[tone])}
      />
      <span className="mt-2 block text-[10px] tracking-[.34em] text-lol-text-muted sm:text-[11px]">{label}</span>
    </Appear>
  );
}

export { StoryStat };
