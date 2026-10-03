"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import { IDENTITY_RING_REFERENCE_SIZE } from "./constants";

type IdentityRingProps = {
  /** Outer diameter in px. Defaults to the Welcome card's own size. */
  size?: number;
  /** The portrait/avatar element centered inside the ring. */
  children: ReactNode;
  /** Content anchored to the ring's bottom edge in the same rotated-diamond
   * chrome as Welcome's summoner-level badge — omit for rings with no
   * badge. */
  badge?: ReactNode;
  className?: string;
};

/**
 * The Welcome card's "identity medallion" chrome — a slow dashed spin ring,
 * a reverse-spinning diamond frame with two breathing gold markers, and a
 * static rotated-diamond backing plate — extracted from `Welcome.tsx` once
 * Guest of Honor needed the same dial around a champion portrait instead of
 * a summoner's profile icon. Every metric (insets, marker sizes/offsets)
 * scales proportionally from the Welcome card's own 228px baseline via a
 * single `scale` ratio, so a smaller `size` reproduces the exact same
 * chrome rather than needing hand-tuned constants per size — unlike
 * `RingFrame` below, whose two sizes ARE hand-tuned per-size (its
 * double-arc SVG dash patterns don't scale cleanly by a flat ratio).
 */
function IdentityRing({ size = IDENTITY_RING_REFERENCE_SIZE, children, badge, className }: IdentityRingProps) {
  const scale = size / IDENTITY_RING_REFERENCE_SIZE;
  const markerSize = 8 * scale;
  const markerOffset = -4 * scale;

  return (
    <div className={cn("relative flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <div className="welcome-spin-slow absolute inset-0 rounded-full border border-dashed border-[rgba(200,170,110,.38)]" />
      <div className="welcome-spin-reverse absolute" style={{ inset: 20 * scale }}>
        <div className="absolute inset-0 rotate-45 border border-[rgba(200,170,110,.45)]" />
        <div
          className="absolute left-1/2 -translate-x-1/2 rotate-45 bg-lol-gold-300"
          style={{ top: markerOffset, height: markerSize, width: markerSize }}
        />
        <div
          className="absolute left-1/2 -translate-x-1/2 rotate-45 bg-lol-gold-300"
          style={{
            bottom: markerOffset,
            height: markerSize,
            width: markerSize,
          }}
        />
      </div>
      <div
        className="absolute rotate-45 border border-[rgba(200,170,110,.7)] bg-[rgba(4,12,20,.6)]"
        style={{
          inset: 38 * scale,
          boxShadow: "0 0 70px rgba(200,170,110,.16)",
        }}
      />
      <div
        className="welcome-breathe-glow absolute inset-0 rounded-full"
        style={{ boxShadow: "0 0 90px rgba(10,200,185,.1) inset" }}
      />
      {children}
      {badge}
    </div>
  );
}

export { IdentityRing };
