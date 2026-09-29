function rate(count: number, total: number): number {
  return total > 0 ? (count / total) * 100 : 0;
}

export { rate };
