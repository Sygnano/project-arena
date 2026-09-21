"use client";

import { useRef, type KeyboardEvent } from "react";
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
  /** Accessible name for the group, e.g. "Sort champions by". */
  label?: string;
  /** `sm` matches the 11px small-caps section headings, for tabs that sit
   * inline next to one. */
  size?: "md" | "sm";
};

/**
 * The "gold diamond + underline" tab row used by every mode switcher on the
 * summoner page. Purely the tab strip itself; callers still own the
 * surrounding row (the `FadingRule`/caption that usually follows it).
 *
 * A real ARIA tablist: each tab is a `<button role="tab">`, only the active
 * tab is in the Tab order (roving tabindex), and Left/Right/Home/End move and
 * select — previously these were `div`s reachable only by mouse.
 */
function DiamondTabs<T extends string>({
  tabs,
  active,
  onChange,
  gap = 24,
  label,
  size = "md",
}: Props<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // `active` can be a value none of the tabs carry — Bans lets its column
  // headers sort by things the two tabs don't name, which leaves both tabs
  // unselected. Without this the roving tabindex would put every tab at -1
  // and drop the whole strip out of the Tab order.
  const hasActive = tabs.some((tab) => tab.key === active);

  function onKeyDown(event: KeyboardEvent, index: number) {
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    if (next < 0) return;
    event.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap items-center gap-y-2"
      style={{ columnGap: gap }}
    >
      {tabs.map((tab, index) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive || (!hasActive && index === 0) ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "group flex cursor-pointer items-center border-b px-0.5 transition-colors duration-150",
              size === "sm" ? "gap-1.5 pb-1" : "gap-2 pb-1.75",
              isActive
                ? "border-lol-gold-300 text-lol-gold-50"
                : "border-transparent text-[#a09b8c] hover:border-[rgba(200,170,110,.35)] hover:text-lol-gold-100",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-1.5 w-1.5 rotate-45 bg-lol-gold-300 transition-opacity duration-150",
                isActive ? "opacity-100" : "opacity-0 group-hover:opacity-60",
              )}
            />
            <span
              className={cn(
                "whitespace-nowrap",
                size === "sm"
                  ? "text-[11px] tracking-[.2em]"
                  : "text-[13px] tracking-[.26em]",
              )}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export { DiamondTabs };
