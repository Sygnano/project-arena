/** A difference between two rates, as a plain subtraction ("+4.2%"): 55% vs
 * 50% is +5%, not +10%. Shown with "%" rather than "pp", which few readers know. */
function formatSignedPoints(delta: number, digits = 1): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  return `${sign}${Math.abs(delta).toFixed(digits)}%`;
}

export { formatSignedPoints };
