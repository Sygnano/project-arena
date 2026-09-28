/** Y-axis ticks: a round step (1, 2, 2.5 or 5 x 10^n) giving 4-7 intervals,
 * whichever leaves the least empty space above `value` — a plain "next round
 * number" put 16.2M on a 20M axis, wasting a fifth of the chart. */
function yAxisTicks(value: number): number[] {
  if (value <= 0) return [0, 1];
  let best: { step: number; count: number } | null = null;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const scale of [magnitude / 10, magnitude]) {
    for (const multiple of [1, 2, 2.5, 5]) {
      const step = multiple * scale;
      const count = Math.ceil(value / step);
      if (count < 4 || count > 7) continue;
      if (!best || step * count < best.step * best.count) best = { step, count };
    }
  }
  const { step, count } = best ?? {
    step: magnitude,
    count: Math.ceil(value / magnitude),
  };
  return Array.from({ length: count + 1 }, (_, i) => i * step);
}

export { yAxisTicks };
