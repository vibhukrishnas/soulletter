import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiFailure } from "@/lib/contracts/api";
import { resetConfigForTests } from "@/server/config/env";
import {
  enforceRateLimit,
  getRateLimiter,
  limitForBucket,
  resetRateLimitersForTests,
  setRateLimiterForTests,
  SlidingWindowRateLimiter,
} from "./rate-limit";

function fakeClock(start = 1_000_000) {
  let now = start;
  return {
    now: () => now,
    advance(ms: number) {
      now += ms;
    },
  };
}

describe("SlidingWindowRateLimiter", () => {
  it("allows `limit` requests per window and then denies with a precise retry delay", () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });

    expect(limiter.check("a")).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0, limit: 3 });
    clock.advance(10_000);
    expect(limiter.check("a").remaining).toBe(1);
    clock.advance(10_000);
    expect(limiter.check("a").remaining).toBe(0);
    clock.advance(5_000);

    // The oldest hit (t=0) leaves the window at t=60 s; we are at t=25 s.
    expect(limiter.check("a")).toEqual({ allowed: false, remaining: 0, retryAfterSeconds: 35, limit: 3 });
  });

  it("slides: capacity returns as individual hits age out", () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1_000, now: clock.now });
    expect(limiter.check("k").allowed).toBe(true); // t=0
    clock.advance(600);
    expect(limiter.check("k").allowed).toBe(true); // t=600
    clock.advance(300);
    expect(limiter.check("k").allowed).toBe(false); // t=900
    clock.advance(100);
    expect(limiter.check("k").allowed).toBe(true); // t=1000: first hit expired
    expect(limiter.check("k").allowed).toBe(false);
    clock.advance(600);
    expect(limiter.check("k").allowed).toBe(true); // t=1600: second hit expired
  });

  it("does not count denied attempts against the client", () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1_000, now: clock.now });
    limiter.check("k");
    for (let i = 0; i < 5; i++) {
      clock.advance(100);
      expect(limiter.check("k").allowed).toBe(false);
    }
    clock.advance(500); // t=1000
    expect(limiter.check("k").allowed).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, now: fakeClock().now });
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    expect(limiter.check("a").allowed).toBe(false);
  });

  it("evicts the least recently seen keys beyond maxKeys", () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowRateLimiter({ limit: 1, maxKeys: 3, now: clock.now });
    for (const key of ["a", "b", "c"]) limiter.check(key);
    limiter.check("a"); // touch "a" so "b" becomes the oldest
    limiter.check("d");
    expect(limiter.size).toBe(3);
    expect(limiter.check("b").allowed).toBe(true); // "b" was evicted, so it starts fresh
    expect(limiter.check("a").allowed).toBe(false); // "a" kept its history
  });

  it("sweeps keys that have been idle for a whole window", () => {
    const clock = fakeClock();
    const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1_000, now: clock.now });
    for (let i = 0; i < 100; i++) limiter.check(`key-${i}`);
    expect(limiter.size).toBe(100);
    clock.advance(1_001);
    limiter.check("fresh");
    expect(limiter.size).toBe(1);
  });

  it("reset() forgets all state", () => {
    const limiter = new SlidingWindowRateLimiter({ limit: 1, now: fakeClock().now });
    limiter.check("a");
    limiter.reset();
    expect(limiter.size).toBe(0);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("validates its options", () => {
    expect(() => new SlidingWindowRateLimiter({ limit: 0 })).toThrow(RangeError);
    expect(() => new SlidingWindowRateLimiter({ limit: 1.5 })).toThrow(RangeError);
    expect(() => new SlidingWindowRateLimiter({ limit: 1, windowMs: 0 })).toThrow(RangeError);
    expect(() => new SlidingWindowRateLimiter({ limit: 1, maxKeys: 0 })).toThrow(RangeError);
  });
});

describe("bucket singletons and enforceRateLimit", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    resetConfigForTests();
    resetRateLimitersForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetConfigForTests();
    resetRateLimitersForTests();
  });

  it("reads per-bucket limits from configuration ('chart' shares the readings limit)", () => {
    vi.stubEnv("RATE_LIMIT_READINGS_PER_MINUTE", "11");
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "12");
    vi.stubEnv("RATE_LIMIT_SHARE_PER_MINUTE", "13");
    resetConfigForTests();
    expect(limitForBucket("readings")).toBe(11);
    expect(limitForBucket("chart")).toBe(11);
    expect(limitForBucket("geocode")).toBe(12);
    expect(limitForBucket("share")).toBe(13);
  });

  it("returns one limiter per bucket", () => {
    expect(getRateLimiter("geocode")).toBe(getRateLimiter("geocode"));
    expect(getRateLimiter("geocode")).not.toBe(getRateLimiter("share"));
    expect(getRateLimiter("chart")).not.toBe(getRateLimiter("readings"));
  });

  it("returns null while allowed and a 429 with Retry-After once exhausted", async () => {
    vi.stubEnv("RATE_LIMIT_SHARE_PER_MINUTE", "2");
    resetConfigForTests();
    const request = () => new Request("http://localhost/api/v1/share", { method: "POST" });

    expect(enforceRateLimit(request(), "share")).toBeNull();
    expect(enforceRateLimit(request(), "share")).toBeNull();
    const limited = enforceRateLimit(request(), "share");
    expect(limited).not.toBeNull();
    expect(limited!.status).toBe(429);
    const retryAfter = Number(limited!.headers.get("retry-after"));
    expect(retryAfter).toBeGreaterThanOrEqual(1);
    expect(retryAfter).toBeLessThanOrEqual(60);
    const body = (await limited!.json()) as ApiFailure;
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(body.error.retryAfterSeconds).toBe(retryAfter);

    // Other buckets are unaffected.
    expect(enforceRateLimit(request(), "geocode")).toBeNull();
  });

  it("keys by client IP when proxy headers are trusted", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "1");
    resetConfigForTests();
    const from = (ip: string) => new Request("http://localhost/", { headers: { "x-forwarded-for": ip } });
    expect(enforceRateLimit(from("192.0.2.1"), "geocode")).toBeNull();
    expect(enforceRateLimit(from("192.0.2.2"), "geocode")).toBeNull();
    expect(enforceRateLimit(from("192.0.2.1"), "geocode")?.status).toBe(429);
  });

  it("allows injecting a limiter for tests", () => {
    const clock = fakeClock();
    setRateLimiterForTests("readings", new SlidingWindowRateLimiter({ limit: 1, now: clock.now }));
    const request = new Request("http://localhost/");
    expect(enforceRateLimit(request, "readings")).toBeNull();
    expect(enforceRateLimit(request, "readings")?.status).toBe(429);
    clock.advance(60_000);
    expect(enforceRateLimit(request, "readings")).toBeNull();
    setRateLimiterForTests("readings", null);
    expect(enforceRateLimit(request, "readings")).toBeNull();
  });
});
