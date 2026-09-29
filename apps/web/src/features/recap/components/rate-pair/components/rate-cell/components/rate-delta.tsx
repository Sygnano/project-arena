import { cn } from "cn";
import { formatSignedPoints } from "@/components/delta-cell";

function RateDelta({ delta, lowSample }: { delta: number; lowSample: boolean }) {
  const tone =
    lowSample || Math.abs(delta) < 1 ? "text-lol-text-muted" : delta > 0 ? "text-[#0ae0cf]" : "text-lol-garnet";
  return (
    <div className={cn("mt-1 text-[11px] tracking-[.12em] tabular-nums", tone)}>
      {lowSample ? "FEW GAMES" : `${formatSignedPoints(delta, 0)} VS AVG`}
    </div>
  );
}

export { RateDelta };
