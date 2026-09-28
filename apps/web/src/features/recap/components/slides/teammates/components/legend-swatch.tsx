"use client";

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="inline-block h-2 w-2" style={{ background: color }} />
      {label}
    </span>
  );
}

export { LegendSwatch };
