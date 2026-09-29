function StatCell({
  label,
  value,
  highlight = false,
  bordered = true,
  nowrap = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  bordered?: boolean;
  nowrap?: boolean;
}) {
  return (
    <div className="px-3.5" style={bordered ? { borderLeft: "1px solid rgba(200,170,110,.16)" } : undefined}>
      <div
        className={`text-[11px] tracking-[.22em] ${nowrap ? "whitespace-nowrap" : ""}`}
        style={{
          color: highlight ? "var(--color-lol-gold-300)" : "var(--color-lol-text-muted)",
        }}
      >
        {label}
      </div>
      <div
        className={`font-display mt-1.5 text-[23px] ${nowrap ? "whitespace-nowrap" : ""}`}
        style={{
          color: highlight ? "var(--color-lol-gold-300)" : "var(--color-lol-gold-50)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export { StatCell };
