import { describe, expect, it } from "vitest";
import { type DamageFrame, decodeFrames, encodeFrames } from "./frames.js";

describe("encodeFrames / decodeFrames", () => {
  it("round-trips a real-sized curve", () => {
    const frames: DamageFrame[] = [
      [0, 0, 0, 0],
      [1, 0, 0, 0],
      [2, 881, 120, 0],
      [3, 1210, 171, 0],
      [9, 8443, 847, 689],
      [29, 123_456, 98_765, 4_321],
    ];
    expect(decodeFrames(encodeFrames(frames))).toEqual(frames);
  });

  it("round-trips values that go down and large ones", () => {
    const frames: DamageFrame[] = [
      [0, 5, 0, 0],
      [1, 3, 0, 0],
      [2, 2_000_000_000, 0, 1],
    ];
    expect(decodeFrames(encodeFrames(frames))).toEqual(frames);
  });

  it("stores small steps in one byte per value", () => {
    expect(encodeFrames([[1, 2, 0, 63]])).toEqual(Buffer.from([2, 4, 0, 126]));
    expect(encodeFrames([[0, -1, 64, 0]])).toEqual(Buffer.from([0, 1, 128, 1, 0]));
  });

  it("handles no frames", () => {
    expect(encodeFrames([])).toEqual(Buffer.alloc(0));
    expect(decodeFrames(Buffer.alloc(0))).toEqual([]);
  });

  it("rejects truncated data", () => {
    expect(() => decodeFrames(Buffer.from([2, 4, 0]))).toThrow("Truncated");
    expect(() => decodeFrames(Buffer.from([2, 4, 0, 128]))).toThrow("Truncated");
  });
});
