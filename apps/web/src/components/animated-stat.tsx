"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AnimatedNumber } from "@/components/animated-number";

interface AnimatedStatProps {
  title: string;
  primaryValue: number;
  primaryLabel: string;
  secondaryValue: number;
  secondaryLabel: string;
  /** Formats the in-flight animated value every frame. Defaults to a
   * rounded, comma-grouped integer. */
  formatPrimary?: (value: number) => string;
  formatSecondary?: (value: number) => string;
  durationMs?: number;
}

export function AnimatedStat({
  title,
  primaryValue,
  primaryLabel,
  secondaryValue,
  secondaryLabel,
  formatPrimary,
  formatSecondary,
  durationMs = 1200,
}: AnimatedStatProps) {
  return (
    <Card className="border-frame-subtle bg-panel hover:border-lol-gold-500 transition-colors">
      <CardHeader>
        <CardTitle className="font-body text-base font-medium text-heading">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-baseline gap-2">
          <AnimatedNumber
            value={primaryValue}
            format={formatPrimary}
            durationMs={durationMs}
            className="font-display text-4xl font-semibold text-lol-gold-50"
          />
          <span className="text-sm text-lol-text-muted">{primaryLabel}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <AnimatedNumber
            value={secondaryValue}
            format={formatSecondary}
            durationMs={durationMs}
            className="font-display text-2xl font-semibold text-lol-text-secondary"
          />
          <span className="text-xs text-lol-text-muted">{secondaryLabel}</span>
        </div>
      </CardContent>
    </Card>
  );
}
