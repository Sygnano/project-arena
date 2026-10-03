import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rateLimitKey, SlidingWindowLimiter } from "./rateLimit.js";

describe("rateLimitKey", () => {
  it("keeps an IPv4 address as is", () => {
    expect(rateLimitKey("203.0.113.7")).toBe("203.0.113.7");
  });

  it("keys IPv6 on its /64, so one household can't rotate addresses", () => {
    expect(rateLimitKey("2001:db8:1:2:aaaa::1")).toBe("2001:db8:1:2::/64");
    expect(rateLimitKey("2001:db8:1:2:ffff:ffff:ffff:ffff")).toBe("2001:db8:1:2::/64");
    expect(rateLimitKey("2001:db8:1:3::1")).not.toBe(rateLimitKey("2001:db8:1:2::1"));
  });

  it("expands :: and ignores a zone id", () => {
    expect(rateLimitKey("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(rateLimitKey("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("treats IPv4-mapped IPv6 as the IPv4 address", () => {
    expect(rateLimitKey("::ffff:203.0.113.7")).toBe("203.0.113.7");
    expect(rateLimitKey("::ffff:cb00:7107")).toBe("203.0.113.7");
  });

  it("passes anything that isn't an IP through", () => {
    expect(rateLimitKey("unknown")).toBe("unknown");
  });
});

describe("SlidingWindowLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuses past the limit until the oldest hit leaves the window", () => {
    const limiter = new SlidingWindowLimiter(2, 10_000);
    expect(limiter.hit("a").ok).toBe(true);
    vi.advanceTimersByTime(4_000);
    expect(limiter.hit("a").ok).toBe(true);
    expect(limiter.hit("a")).toEqual({ ok: false, retryAfterSeconds: 6 });
    expect(limiter.hit("b").ok).toBe(true);
    vi.advanceTimersByTime(6_000);
    expect(limiter.hit("a").ok).toBe(true);
  });

  it("doesn't count a refused hit", () => {
    const limiter = new SlidingWindowLimiter(1, 10_000);
    limiter.hit("a");
    vi.advanceTimersByTime(5_000);
    limiter.hit("a");
    vi.advanceTimersByTime(5_000);
    expect(limiter.hit("a").ok).toBe(true);
  });
});
