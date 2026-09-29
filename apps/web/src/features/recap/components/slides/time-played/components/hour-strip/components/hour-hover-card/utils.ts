function pad(hour: number) {
  return String(hour).padStart(2, "0");
}

function percent(part: number, whole: number) {
  return `${((part / whole) * 100).toFixed(0)}%`;
}

export { pad, percent };
