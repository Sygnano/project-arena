"use client";

import { cn } from "cn";

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Tooltip explaining what the switch changes. */
  title?: string;
  className?: string;
};

/**
 * A bordered on/off switch for panel header rows: a gold-framed chip with a
 * small track whose diamond knob slides across. Framed on purpose, so it reads
 * as a control next to the DiamondTabs rather than as more caption text.
 */
function HextechSwitch({ checked, onChange, label, title, className }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      title={title}
      onClick={() => onChange(!checked)}
      className={cn(
        "group inline-flex flex-none cursor-pointer items-center gap-2.5 border px-3 py-1.5 text-[11px] tracking-[.22em] uppercase transition-[border-color,background,color,box-shadow] duration-200 select-none motion-reduce:transition-none",
        checked
          ? "border-lol-gold-300/80 bg-lol-gold-300/10 text-lol-gold-50 shadow-[0_0_12px_rgba(200,170,110,.18)]"
          : "border-lol-gold-300/40 bg-[rgba(240,230,210,.03)] text-lol-gold-100/80 hover:border-lol-gold-300/75 hover:text-lol-gold-50",
        className,
      )}
    >
      {/* A single gold line; the diamond slides along it and fills when on. */}
      <span aria-hidden className="relative h-3 w-7 flex-none">
        <span
          className={cn(
            "absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors duration-200 motion-reduce:transition-none",
            checked ? "bg-lol-gold-300" : "bg-lol-gold-300/45",
          )}
        />
        <span
          className={cn(
            "absolute top-1/2 left-0.5 h-2 w-2 -translate-y-1/2 rotate-45 border transition-[translate,background,border-color,box-shadow] duration-200 motion-reduce:transition-none",
            checked
              ? "translate-x-4 border-lol-gold-100 bg-lol-gold-300 shadow-[0_0_6px_rgba(200,170,110,.6)]"
              : "border-lol-gold-300/80 bg-[#040c14]",
          )}
        />
      </span>
      {label}
    </button>
  );
}

export { HextechSwitch };
