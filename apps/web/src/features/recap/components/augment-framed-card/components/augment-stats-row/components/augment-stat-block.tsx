/** One `PICKED`/`WINS`/`1ST` figure — the count on its own line, larger
 * than the label beneath it, rather than a single inline "N PICKED" run.
 * Sized in `cqw` (see `AugmentFramedCard`). */
function AugmentStatBlock({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="font-display text-[max(15px,9cqw)] leading-none text-lol-gold-50 tabular-nums">{value}</div>
      <div className="font-body mt-[1.5cqw] text-[max(10px,4.4cqw)] tracking-[.12em] whitespace-nowrap text-lol-text-muted">
        {label}
      </div>
    </div>
  );
}

export { AugmentStatBlock };
