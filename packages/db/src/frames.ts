/** One timeline frame of a participant's damage to champions, cumulative since the game's start.
 * `minute` is the frame's timestamp rounded to the nearest minute: frames land ~every 60 s plus a
 * final one at the match's end, and the damage curve, the only reader, works per whole minute. */
export type DamageFrame = [minute: number, physical: number, magical: number, trueDamage: number];

/**
 * `match_participants.frames` on disk: each frame's four values as differences from the previous
 * frame's (the first frame's from zeros), zigzag-encoded (0, -1, 1, -2… → 0, 1, 2, 3…) as
 * little-endian base-128 varints, back to back. About 6 bytes a frame against jsonb's ~15.
 * Migration 0022 converted the jsonb with the same encoding in SQL: change both or neither.
 */
export function encodeFrames(frames: readonly DamageFrame[]): Buffer {
  const bytes: number[] = [];
  let previous: readonly number[] = [0, 0, 0, 0];
  for (const frame of frames) {
    for (let i = 0; i < 4; i++) {
      const value = frame[i] ?? 0;
      if (!Number.isSafeInteger(value)) throw new Error(`Frame value must be an integer: ${value}`);
      const delta = value - (previous[i] ?? 0);
      let zigzag = delta >= 0 ? delta * 2 : -delta * 2 - 1;
      while (zigzag >= 128) {
        bytes.push((zigzag % 128) + 128);
        zigzag = Math.floor(zigzag / 128);
      }
      bytes.push(zigzag);
    }
    previous = frame;
  }
  return Buffer.from(bytes);
}

export function decodeFrames(bytes: Uint8Array): DamageFrame[] {
  const frames: DamageFrame[] = [];
  const values = [0, 0, 0, 0];
  let field = 0;
  let position = 0;
  while (position < bytes.length) {
    let zigzag = 0;
    let scale = 1;
    for (;;) {
      if (position >= bytes.length) throw new Error("Truncated frames");
      const byte = bytes[position++]!;
      zigzag += (byte % 128) * scale;
      if (byte < 128) break;
      scale *= 128;
    }
    values[field]! += zigzag % 2 === 0 ? zigzag / 2 : -(zigzag + 1) / 2;
    field += 1;
    if (field === 4) {
      frames.push([values[0]!, values[1]!, values[2]!, values[3]!]);
      field = 0;
    }
  }
  if (field !== 0) throw new Error("Truncated frames");
  return frames;
}
