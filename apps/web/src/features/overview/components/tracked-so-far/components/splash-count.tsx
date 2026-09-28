import { AnimatedNumber } from "@/components/animated-number";

type Props = { value: number; label: string };

/** One splash total: a count-up number over its caption. */
function SplashCount({ value, label }: Props) {
  return (
    <p className="flex flex-col items-center gap-1.5">
      <AnimatedNumber
        value={value}
        className="font-display text-[26px] leading-none text-lol-gold-50 tabular-nums sm:text-[30px]"
      />
      <span className="text-center text-[10px] tracking-[.32em] text-lol-text-muted sm:text-[11px]">{label}</span>
    </p>
  );
}

export { SplashCount };
