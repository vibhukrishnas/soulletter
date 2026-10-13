import { describe, expect, it } from "vitest";
import { formatArc, formatDms, normalizeDegrees, signedDeltaDegrees, toDms } from "./angles";

describe("normalizeDegrees", () => {
  it.each([
    [0, 0],
    [360, 0],
    [720, 0],
    [-0.1, 359.9],
    [-360, 0],
    [-720.5, 359.5],
    [359.999999, 359.999999],
    [123.456, 123.456],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeDegrees(input)).toBeCloseTo(expected, 12);
  });

  it("keeps results in the half-open range [0, 360) even for tiny negatives", () => {
    const r = normalizeDegrees(-1e-17);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThan(360);
  });

  it("never returns negative zero", () => {
    expect(Object.is(normalizeDegrees(-0), 0)).toBe(true);
    expect(Object.is(normalizeDegrees(-360), 0)).toBe(true);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])("rejects %s", (bad) => {
    expect(() => normalizeDegrees(bad)).toThrow(RangeError);
  });
});

describe("signedDeltaDegrees", () => {
  it("returns the shortest signed difference across 0°/360°", () => {
    expect(signedDeltaDegrees(359, 1)).toBeCloseTo(2, 12);
    expect(signedDeltaDegrees(1, 359)).toBeCloseTo(-2, 12);
    expect(signedDeltaDegrees(10, 190)).toBeCloseTo(180, 12);
  });
});

describe("toDms / formatDms", () => {
  it("splits degrees, minutes and seconds", () => {
    expect(toDms(20.114955142, 3)).toEqual({ degrees: 20, minutes: 6, seconds: 53.839 });
  });

  it("carries rounding instead of printing 60 seconds", () => {
    // 16°40′59.99996″ rounds up to 16°41′00.0″
    expect(toDms(16 + 40 / 60 + 59.99996 / 3600, 1)).toEqual({ degrees: 16, minutes: 41, seconds: 0 });
    expect(formatDms(29.99999999, 1)).toBe("30°00′00.0″");
  });

  it("formats with zero padding", () => {
    expect(formatDms(5 + 3 / 60 + 7.25 / 3600, 2)).toBe("5°03′07.25″");
  });
});

describe("formatArc", () => {
  it("chooses readable units", () => {
    expect(formatArc(0.37)).toBe("0.37″");
    expect(formatArc(90)).toBe("1.5′");
    expect(formatArc(7200)).toBe("2.00°");
  });
});
