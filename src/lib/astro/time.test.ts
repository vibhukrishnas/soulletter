import { describe, expect, it } from "vitest";
import {
  formatLocal,
  formatOffset,
  isLeapYear,
  isValidIanaTimeZone,
  julianDayFromUnixMillis,
  looksLikeLocalMeanTime,
  meeusJulianDay,
  offsetSecondsAt,
  parseClockTime,
  parseIsoDate,
  resolveLocalDateTime,
} from "./time";

describe("leap years and calendar dates", () => {
  it.each([
    [1900, false],
    [2000, true],
    [2023, false],
    [2024, true],
    [2100, false],
    [1600, true],
  ])("isLeapYear(%i) = %s", (y, expected) => {
    expect(isLeapYear(y)).toBe(expected);
  });

  it.each(["2000-02-29", "2024-02-29", "1990-10-15", "1800-01-01", "2100-12-31"])("accepts %s", (d) => {
    expect(parseIsoDate(d)).not.toBeNull();
  });

  it.each(["1900-02-29", "2023-02-29", "2023-04-31", "1990-13-01", "1990-00-10", "1990-1-5", "15/10/1990", "", "1990-10-15T00:00"])(
    "rejects %s",
    (d) => {
      expect(parseIsoDate(d)).toBeNull();
    },
  );
});

describe("clock times", () => {
  it("parses HH:mm and HH:mm:ss", () => {
    expect(parseClockTime("14:30")).toEqual({ hour: 14, minute: 30, second: 0 });
    expect(parseClockTime("23:59:59")).toEqual({ hour: 23, minute: 59, second: 59 });
    expect(parseClockTime("00:00")).toEqual({ hour: 0, minute: 0, second: 0 });
  });

  it.each(["24:00", "9:30", "12:60", "12:30:60", "2:30 PM", ""])("rejects %s", (t) => {
    expect(parseClockTime(t)).toBeNull();
  });
});

describe("IANA time-zone validation", () => {
  it.each(["Asia/Kolkata", "Asia/Calcutta", "America/New_York", "Europe/London", "UTC", "America/Argentina/Buenos_Aires"])(
    "accepts %s",
    (tz) => {
      expect(isValidIanaTimeZone(tz)).toBe(true);
    },
  );

  it.each(["+05:30", "GMT+5", "Foo/Bar", "", "Asia/Kolkata; DROP", "../etc/passwd", "IST"])("rejects %s", (tz) => {
    expect(isValidIanaTimeZone(tz)).toBe(false);
  });
});

describe("historical UTC offsets from tzdb", () => {
  it("resolves India Standard Time and its wartime offset", () => {
    expect(offsetSecondsAt(Date.UTC(1990, 9, 15, 9), "Asia/Kolkata")).toBe(5.5 * 3600);
    // 1942-09-01 to 1945-10-15: UTC+06:30 ("war time")
    expect(offsetSecondsAt(Date.UTC(1943, 5, 1, 6), "Asia/Kolkata")).toBe(6.5 * 3600);
  });

  it("keeps local-mean-time offsets with seconds", () => {
    const off = offsetSecondsAt(Date.UTC(1890, 0, 1), "Asia/Kolkata");
    expect(formatOffset(off)).toBe("+05:21:10");
    expect(looksLikeLocalMeanTime(off)).toBe(true);
  });

  it("handles daylight saving time", () => {
    expect(offsetSecondsAt(Date.UTC(2021, 6, 1, 12), "America/New_York")).toBe(-4 * 3600);
    expect(offsetSecondsAt(Date.UTC(2021, 0, 15, 12), "America/New_York")).toBe(-5 * 3600);
  });
});

describe("local time → UTC", () => {
  it("converts the reference case 1990-10-15 14:30 IST to 09:00 UTC", () => {
    const r = resolveLocalDateTime({ year: 1990, month: 10, day: 15 }, { hour: 14, minute: 30, second: 0 }, "Asia/Kolkata");
    expect(r.kind).toBe("unique");
    if (r.kind !== "unique") return;
    expect(new Date(r.instant.utcMillis).toISOString()).toBe("1990-10-15T09:00:00.000Z");
    expect(r.instant.offsetSeconds).toBe(19800);
  });

  it("uses the wartime offset for 1943 Delhi", () => {
    const r = resolveLocalDateTime({ year: 1943, month: 6, day: 1 }, { hour: 12, minute: 0, second: 0 }, "Asia/Kolkata");
    expect(r.kind).toBe("unique");
    if (r.kind === "unique") expect(new Date(r.instant.utcMillis).toISOString()).toBe("1943-06-01T05:30:00.000Z");
  });

  it("reports a nonexistent spring-forward time instead of guessing", () => {
    const r = resolveLocalDateTime({ year: 2021, month: 3, day: 14 }, { hour: 2, minute: 30, second: 0 }, "America/New_York");
    expect(r.kind).toBe("nonexistent");
    if (r.kind === "nonexistent") {
      expect(r.offsetBeforeSeconds).toBe(-5 * 3600);
      expect(r.offsetAfterSeconds).toBe(-4 * 3600);
    }
  });

  it("reports an ambiguous fall-back time with both instants", () => {
    const r = resolveLocalDateTime({ year: 2021, month: 11, day: 7 }, { hour: 1, minute: 30, second: 0 }, "America/New_York");
    expect(r.kind).toBe("ambiguous");
    if (r.kind === "ambiguous") {
      expect(new Date(r.earlier.utcMillis).toISOString()).toBe("2021-11-07T05:30:00.000Z");
      expect(new Date(r.later.utcMillis).toISOString()).toBe("2021-11-07T06:30:00.000Z");
    }
  });

  it("handles a whole skipped calendar day (Samoa, 2011-12-30)", () => {
    const r = resolveLocalDateTime({ year: 2011, month: 12, day: 30 }, { hour: 12, minute: 0, second: 0 }, "Pacific/Apia");
    expect(r.kind).toBe("nonexistent");
  });

  it("formats local wall-clock time in a zone", () => {
    expect(formatLocal(Date.UTC(1990, 9, 15, 9), "Asia/Kolkata")).toBe("1990-10-15 14:30");
  });
});

describe("Julian Day", () => {
  it("matches the audit value for the reference case", () => {
    expect(julianDayFromUnixMillis(Date.UTC(1990, 9, 15, 9))).toBe(2448179.875);
    expect(meeusJulianDay(1990, 10, 15 + 9 / 24)).toBeCloseTo(2448179.875, 9);
  });

  it("matches J2000.0 and Meeus' worked examples", () => {
    expect(julianDayFromUnixMillis(Date.UTC(2000, 0, 1, 12))).toBe(2451545.0);
    expect(meeusJulianDay(1957, 10, 4.81)).toBeCloseTo(2436116.31, 9); // Meeus example 7.a
    expect(meeusJulianDay(2000, 1, 1.5)).toBeCloseTo(2451545.0, 9);
    expect(meeusJulianDay(1987, 1, 27.0)).toBeCloseTo(2446822.5, 9);
    expect(meeusJulianDay(1988, 6, 19.5)).toBeCloseTo(2447332.0, 9);
    expect(meeusJulianDay(1900, 1, 1.0)).toBeCloseTo(2415020.5, 9);
  });

  it("agrees between the two independent implementations over many dates", () => {
    for (let i = 0; i < 500; i++) {
      const ms = Date.UTC(1800, 0, 1) + i * 191_234_567_891;
      const d = new Date(ms);
      const dayFraction =
        d.getUTCDate() + (d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600 + d.getUTCMilliseconds() / 3.6e6) / 24;
      expect(meeusJulianDay(d.getUTCFullYear(), d.getUTCMonth() + 1, dayFraction)).toBeCloseTo(julianDayFromUnixMillis(ms), 7);
    }
  });
});
