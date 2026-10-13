import { describe, expect, it } from "vitest";
import { memoizeByTime, scanTimeline } from "./timeline";

describe("scanTimeline", () => {
  const stepFn = (changes: number[]) => (t: number) => changes.filter((c) => t >= c).length;

  it("returns a single segment when nothing changes", () => {
    expect(scanTimeline(0, 10_000, 1000, () => 7)).toEqual([{ from: 0, to: 10_000, key: 7 }]);
  });

  it("locates a change to the requested resolution", () => {
    const segs = scanTimeline(0, 100_000, 10_000, stepFn([42_345]), 1);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toMatchObject({ from: 0, key: 0 });
    expect(Math.abs(segs[0].to - 42_345)).toBeLessThanOrEqual(1);
    expect(segs[1]).toMatchObject({ key: 1, to: 100_000 });
  });

  it("finds several changes that fall between two samples", () => {
    const segs = scanTimeline(0, 100_000, 50_000, stepFn([10_000, 20_000, 30_000]), 1);
    expect(segs.map((s) => s.key)).toEqual([0, 1, 2, 3]);
    expect(segs.map((s) => Math.round(s.to / 1000))).toEqual([10, 20, 30, 100]);
  });

  it("handles a zero-length window", () => {
    expect(scanTimeline(5, 5, 1000, () => "a")).toEqual([{ from: 5, to: 5, key: "a" }]);
  });

  it("rejects invalid arguments", () => {
    expect(() => scanTimeline(10, 0, 1000, () => 0)).toThrow(RangeError);
    expect(() => scanTimeline(0, 10, 0, () => 0)).toThrow(RangeError);
  });
});

describe("memoizeByTime", () => {
  it("evaluates each instant once", () => {
    let calls = 0;
    const f = memoizeByTime((t) => {
      calls++;
      return t * 2;
    });
    expect(f(10)).toBe(20);
    expect(f(10)).toBe(20);
    expect(calls).toBe(1);
  });
});
