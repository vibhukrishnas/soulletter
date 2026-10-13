import { describe, expect, it } from "vitest";
import type { BirthInput } from "@/lib/contracts/input";
import { buildTimeContext, normalizeBirth } from "./time-context";

function birth(overrides: Omit<Partial<BirthInput>, "place"> & { place?: Partial<BirthInput["place"]> } = {}): BirthInput {
  const { place, ...rest } = overrides;
  return {
    birthDate: "1990-10-15",
    birthTimeKnown: true,
    birthTime: "14:30",
    birthTimeAccuracy: "to_the_minute",
    dstChoice: null,
    ...rest,
    place: { label: "New Delhi", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata", ...place },
  };
}

const iso = (ms: number) => new Date(ms).toISOString();

describe("buildTimeContext", () => {
  it("builds an exact instant with a ±1 minute recording window", () => {
    const r = buildTimeContext(normalizeBirth(birth()));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ctx.basis).toBe("exact_instant");
    expect(iso(r.ctx.nominalUtc as number)).toBe("1990-10-15T09:00:00.000Z");
    expect(r.ctx.offsetSeconds).toBe(19800);
    expect(r.ctx.windowEnd - r.ctx.windowStart).toBe(2 * 60_000);
  });

  it.each([
    ["within_15_minutes", 30 * 60_000],
    ["within_1_hour", 120 * 60_000],
  ] as const)("widens the window for %s", (accuracy, width) => {
    const r = buildTimeContext(normalizeBirth(birth({ birthTimeAccuracy: accuracy })));
    expect(r.ok && r.ctx.windowEnd - r.ctx.windowStart).toBe(width);
  });

  it("uses the whole local day when the birth time is unknown", () => {
    const r = buildTimeContext(normalizeBirth(birth({ birthTimeKnown: false, birthTime: null, birthTimeAccuracy: null })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.ctx.basis).toBe("local_day");
    expect(r.ctx.nominalUtc).toBeNull();
    expect(iso(r.ctx.windowStart)).toBe("1990-10-14T18:30:00.000Z");
    expect(iso(r.ctx.windowEnd)).toBe("1990-10-15T18:30:00.000Z");
  });

  it("handles a 23-hour local day at the spring DST change", () => {
    const r = buildTimeContext(
      normalizeBirth(
        birth({
          birthDate: "2021-03-14",
          birthTimeKnown: false,
          birthTime: null,
          birthTimeAccuracy: null,
          place: { latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
        }),
      ),
    );
    expect(r.ok && r.ctx.windowEnd - r.ctx.windowStart).toBe(23 * 3_600_000);
  });

  it("refuses to guess an ambiguous local time", () => {
    const r = buildTimeContext(
      normalizeBirth(
        birth({
          birthDate: "2021-11-07",
          birthTime: "01:30",
          place: { latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.code).toBe("AMBIGUOUS_LOCAL_TIME");
    if (r.code === "AMBIGUOUS_LOCAL_TIME") {
      expect(r.details.earlier).toEqual({ utc: "2021-11-07T05:30:00Z", offset: "-04:00" });
      expect(r.details.later).toEqual({ utc: "2021-11-07T06:30:00Z", offset: "-05:00" });
    }
  });

  it("uses the user's explicit choice for an ambiguous time", () => {
    const r = buildTimeContext(
      normalizeBirth(
        birth({
          birthDate: "2021-11-07",
          birthTime: "01:30",
          dstChoice: "later",
          place: { latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
        }),
      ),
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(iso(r.ctx.nominalUtc as number)).toBe("2021-11-07T06:30:00.000Z");
    expect(r.ctx.dst).toBe("ambiguous_later");
  });

  it("rejects a nonexistent local time", () => {
    const r = buildTimeContext(
      normalizeBirth(
        birth({
          birthDate: "2021-03-14",
          birthTime: "02:30",
          place: { latitude: 40.7128, longitude: -74.006, timeZone: "America/New_York" },
        }),
      ),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("NONEXISTENT_LOCAL_TIME");
  });

  it("considers every UTC offset when the time zone is unknown", () => {
    const known = buildTimeContext(
      normalizeBirth(birth({ place: { latitude: null, longitude: null, timeZone: null } })),
    );
    expect(known.ok).toBe(true);
    if (!known.ok) return;
    expect(known.ctx.basis).toBe("utc_window");
    expect(known.ctx.nominalUtc).toBeNull();
    expect(iso(known.ctx.windowStart)).toBe("1990-10-15T00:30:00.000Z");
    expect(iso(known.ctx.windowEnd)).toBe("1990-10-16T02:30:00.000Z");

    const unknownTime = buildTimeContext(
      normalizeBirth(
        birth({
          birthTimeKnown: false,
          birthTime: null,
          birthTimeAccuracy: null,
          place: { latitude: null, longitude: null, timeZone: null },
        }),
      ),
    );
    expect(unknownTime.ok && unknownTime.ctx.windowEnd - unknownTime.ctx.windowStart).toBe(50 * 3_600_000);
  });
});
