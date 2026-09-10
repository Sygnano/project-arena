type Props = {
  /** The big centered number row, e.g. a single `AnimatedNumber` (KDA's
   * "3.42") or a compound one like TimePlayed's `AnimatedNumber` + "h" +
   * `AnimatedNumber` + "m" — content varies, this only owns the shared
   * chrome around it. */
  children: React.ReactNode;
  label: string;
};

/** The headline stat at the top of a `CategoryLayout` sidebar — a big number
 * over a muted label (e.g. KDA's "3.42" / "KDA", Positions' "142" / "Games
 * Played"). */
function SidebarHeadline({ children, label }: Props) {
  return (
    <div className="py-4">
      <div className="flex items-baseline justify-center gap-2">
        {children}
      </div>
      <div className="font-body text-center text-lg text-lol-text-muted">
        {label}
      </div>
    </div>
  );
}

export { SidebarHeadline };
