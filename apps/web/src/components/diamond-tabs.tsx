"use client";

import { cn } from "cn";

type Tab<T extends string> = {
  key: T;
  label: string;
};

type Props<T extends string> = {
  tabs: readonly Tab<T>[];
  active: T;
  onChange: (key: T) => void;
  /** Gap between tabs, in px — defaults to KDA's original 24px (`gap-6`). */
  gap?: number;
};

/**
 * The "gold diamond + underline" tab row first built inline for KDA's
 * KILLS/DEATHS/ASSISTS/KDA metric switcher — pulled out once Banned
 * Champions' MOST BANNED/BIGGEST SWING and Damage's TOTAL/BEST GAME tabs
 * needed the exact same look (see design_handoff_arena_panels/README.md).
 * Purely the tab strip itself; callers still own the surrounding row (the
 * `FadingRule`/legend/caption that usually follows it).
 */
function DiamondTabs<T extends string>({
  tabs,
  active,
  onChange,
  gap = 24,
}: Props<T>) {
  return (
    <div className="flex items-center" style={{ gap }}>
      {tabs.map((tab) => {
        const isActive = active === tab.key;
        return (
          <div
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className={cn(
              "group flex cursor-pointer items-center gap-2 border-b px-0.5 pb-1.75 transition-colors duration-150",
              isActive
                ? "border-lol-gold-300 text-lol-gold-50"
                : "border-transparent text-[#8a8578] hover:border-[rgba(200,170,110,.35)] hover:text-lol-gold-100",
            )}
          >
            <div
              className={cn(
                "h-1.5 w-1.5 rotate-45 bg-lol-gold-300 transition-opacity duration-150",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
              )}
            />
            <div className="text-[13px] tracking-[.26em]">{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
}

export { DiamondTabs };
