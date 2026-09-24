function RecordColumn({
  heading,
  headingColor,
  rows,
  className,
  bordered = false,
}: {
  heading: string;
  headingColor: string;
  rows: readonly [string, number | string][];
  className?: string;
  bordered?: boolean;
}) {
  return (
    <div className={className} style={bordered ? { borderLeft: "1px solid rgba(200,170,110,.16)" } : undefined}>
      <div className="mb-3.5 text-[11px] tracking-[.28em]" style={{ color: headingColor }}>
        {heading}
      </div>
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center gap-3.5 py-2.75"
          style={{ borderTop: "1px solid rgba(200,170,110,.14)" }}
        >
          <div className="flex-1 text-[13.5px] tracking-[.12em] text-lol-text-secondary">{label}</div>
          <div className="font-display text-[21px] text-lol-gold-50">
            {typeof value === "number" ? value.toLocaleString() : value}
          </div>
        </div>
      ))}
    </div>
  );
}

export { RecordColumn };
