import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/v1/chart/preview/route";
import { RASHI_NAMES, grahaLabel, rashiLabel } from "@/lib/astro/names";
import type { ChartPreview } from "@/lib/contracts/preview";
import { numerologyPreview } from "@/lib/client/preview";
import { resetConfigForTests } from "@/server/config/env";
import { resetRateLimitersForTests } from "@/server/http/rate-limit";

const birth = (over: Record<string, unknown> = {}) => ({
  birthDate: "1990-10-15",
  birthTimeKnown: true,
  birthTime: "14:30",
  birthTimeAccuracy: "to_the_minute",
  dstChoice: null,
  place: { label: "New Delhi", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" },
  ...over,
});

async function preview(b: unknown): Promise<{ status: number; body: { ok: boolean; data: ChartPreview; error?: { code: string } } }> {
  const res = await POST(new Request("http://localhost/api/v1/chart/preview", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ birth: b }),
  }));
  return { status: res.status, body: await res.json() };
}

beforeEach(() => {
  resetConfigForTests();
  resetRateLimitersForTests();
});

describe("POST /api/v1/chart/preview", () => {
  it("returns the user's actual placements and every convention option", async () => {
    const { status, body } = await preview(birth());
    expect(status).toBe(200);
    const p = body.data;
    const moon = p.bodies.find((b) => b.body === "Moon")!.atBirth!;
    expect(rashiLabel(moon.signIndex)).toBe("Simha (Leo)");
    expect([moon.nakshatraName, moon.pada]).toEqual(["Purva Phalguni", 3]);
    expect(rashiLabel(p.bodies.find((b) => b.body === "Sun")!.atBirth!.signIndex)).toBe("Kanya (Virgo)");
    expect(rashiLabel(p.lagna.atBirth!.signIndex)).toBe("Makara (Capricorn)");
    expect(p.seventhHouse).toMatchObject({ signIndex: 3, lord: "Moon" });
    expect(grahaLabel(p.darakaraka.seven_planet.mean!.body)).toBe("Guru (Jupiter)");
    expect(p.darakaraka.seven_planet.mean!.boundarySensitive).toBe(true);
    expect(p.darakaraka.eight_planet.true).not.toBeNull();
    expect(p.rahu.mean!.longitudeDeg).not.toBe(p.rahu.true!.longitudeDeg);
    expect(p.ayanamshaDeg).toBeCloseTo(23.7284, 3);
  });

  it("without a birth time it reports spans and gives a reason instead of a Lagna", async () => {
    const { body } = await preview(birth({ birthTimeKnown: false, birthTime: null, birthTimeAccuracy: null }));
    const p = body.data;
    expect(p.lagna.atBirth).toBeNull();
    expect(p.lagna.reason).toMatch(/birth time/i);
    expect(p.bodies.find((b) => b.body === "Moon")!.spans.length).toBeGreaterThan(1);
    expect(p.darakaraka.seven_planet.mean).toBeNull();
  });

  it("rejects invalid input with field errors", async () => {
    const { status, body } = await preview(birth({ birthDate: "1990-02-30" }));
    expect(status).toBe(422);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
  });
});

describe("display names and numerology preview", () => {
  it("has Sanskrit, Hindi and Devanagari names for all 12 Rashis", () => {
    expect(RASHI_NAMES).toHaveLength(12);
    expect(RASHI_NAMES[1]).toEqual({ english: "Taurus", sanskrit: "Vrishabha", hindi: "Vrishabh", devanagari: "वृषभ" });
  });

  it("computes every Life Path option for the date", () => {
    const n = numerologyPreview("1940-03-12", "")!;
    expect(n.lifePath.reduce_components.keep_11_22_33).toBe(11);
    expect(n.lifePath.full_digit_sum.keep_11_22_33).toBe(2);
    expect(n.lifePath.reduce_components.none).toBe(2);
    expect(n.pythagorean).toBeNull();
  });
});
