/**
 * Honeycomb rows: long and short rows alternate (`columns`, `columns - 1`),
 * each centred, which is what staggers them into a comb. The last row keeps
 * its full slot count and pads with empty slots on both sides, so a short
 * final row still lands on the lattice instead of re-centring off it.
 */
function combRows(count: number, columns: number): number[] {
  const rows: number[] = [];
  let placed = 0;
  while (placed < count) {
    const length = rows.length % 2 === 0 ? columns : Math.max(1, columns - 1);
    rows.push(length);
    placed += length;
  }
  return rows;
}

export { combRows };
