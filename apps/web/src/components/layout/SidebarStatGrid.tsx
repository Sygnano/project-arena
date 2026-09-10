type Props = {
  /** Alternating label/value pairs, e.g. `<span>Kills</span>` followed by
   * whatever renders that stat's value (a plain `AnimatedNumber` row, a
   * `DurationStat`/`CountStat`, or even plain text like a favorite day). */
  children: React.ReactNode;
};

/** The label/value stat rows below a `SidebarHeadline` in a `CategoryLayout`
 * sidebar. Distinct from the plainer `StatGrid` (used by Kills/Utility/Fun) —
 * this one's values aren't always a single number, so it stays a bare grid
 * wrapper rather than mapping over a `[label, value]` tuple list. */
function SidebarStatGrid({ children }: Props) {
  return (
    <div className="grid flex-1 grid-cols-[auto_1fr] content-center gap-x-8 gap-y-4">
      {children}
    </div>
  );
}

export { SidebarStatGrid };
