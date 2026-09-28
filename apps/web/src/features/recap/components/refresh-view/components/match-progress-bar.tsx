type Props = { done: number; total: number };

/** "Match X of Y" as a bar under the queue screen's text. */
function MatchProgressBar({ done, total }: Props) {
  return (
    <div
      role="progressbar"
      aria-label="Matches fetched"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className="mx-auto mt-4 h-1 w-full max-w-xs overflow-hidden bg-[rgba(200,170,110,.15)]"
    >
      <div
        className="h-full bg-[linear-gradient(90deg,#c8aa6e,#0ac8b9)] shadow-[0_0_8px_rgba(10,200,185,.6)] transition-[width] duration-700 ease-out"
        style={{ width: `${(done / total) * 100}%` }}
      />
    </div>
  );
}

export { MatchProgressBar };
