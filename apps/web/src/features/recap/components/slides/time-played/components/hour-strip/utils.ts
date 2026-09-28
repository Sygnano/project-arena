function pad(hour: number) {
  return String(hour).padStart(2, "0");
}

function plural(count: number, noun: string) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export { pad, plural };
