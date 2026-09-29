"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { HexComb, type HexCombCell } from "@/components/hex-comb";

type Props = {
  cells: HexCombCell[];
  /** Size of the box the comb fits into (it shrinks its hexagons to fit). */
  className?: string;
  imageClassName?: string;
  /** Seconds before the ripple starts: after the slide's own entrance, so the
   * comb never slides or scales along with it. */
  delay?: number;
};

const noHover = () => {};

/**
 * The Hall of Fame honeycomb, for a story slide: a still picture, no hover
 * cards, always fitted to its box so it never pushes the slide past the
 * screen. It stays hidden while the slide comes in, then its cells ripple
 * in from the centre, as in the full stats.
 */
function StoryComb({ cells, className, imageClassName, delay = 0.9 }: Props) {
  const hoverRef = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setPlay(true), delay * 1000);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className={cn("flex min-h-0", className)}>
      <HexComb
        cells={cells}
        gap={5}
        minColumns={2}
        maxColumns={14}
        maxHexWidth={96}
        flowHexWidth={56}
        alwaysFit
        play={play}
        hoveredId={undefined}
        onHover={noHover}
        hoverRef={hoverRef}
        imageClassName={imageClassName}
      />
    </div>
  );
}

export { StoryComb };
