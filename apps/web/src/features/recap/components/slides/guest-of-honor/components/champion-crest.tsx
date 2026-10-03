"use client";

import type { CSSProperties } from "react";
import { RING_WIDTH } from "@/features/recap/components/augment-framed-card";
import { iconName } from "@/features/recap/components/slides/guest-of-honor/utils";
import { championIconUrl } from "@/utils/riot";

function ChampionCrest({ championName }: { championName: string }) {
  return (
    <img
      loading="lazy"
      decoding="async"
      src={championIconUrl(iconName(championName))}
      alt=""
      width={40}
      height={40}
      style={
        {
          "--augment-frame-fill": "var(--color-lol-navy-900)",
          "--augment-frame-width": RING_WIDTH.gold,
        } as CSSProperties
      }
      className="aspect-square w-10 flex-none rounded-full object-cover augment-frame augment-frame-gold"
    />
  );
}

export { ChampionCrest };
