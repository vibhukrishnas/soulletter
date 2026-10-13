/**
 * Route-handler integration tests: real handlers, real calculation engine, no network.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as chartPOST } from "@/app/api/v1/chart/route";
import { POST as numerologyPOST } from "@/app/api/v1/numerology/route";
import { POST as readingsPOST } from "@/app/api/v1/readings/route";
import { GET as rulesGET } from "@/app/api/v1/rules/route";
import { GET as shareGET } from "@/app/api/v1/share/[token]/route";
import { POST as sharePOST } from "@/app/api/v1/share/route";
import type { ReadingStreamEvent } from "@/lib/contracts/api";
import { resetConfigForTests } from "@/server/config/env";
import { SlidingWindowRateLimiter, resetRateLimitersForTests, setRateLimiterForTests } from "@/server/http/rate-limit";

const SECRET = "test-share-secret-0123456789abcdefghijklmnop";

const validReading = () => ({
  birth: {
    birthDate: "1990-10-15",
    birthTimeKnown: true,
    birthTime: "14:30",
    birthTimeAccuracy: "to_the_minute",
    dstChoice: null,
    place: { label: "New Delhi, Delhi, India", latitude: 28.6139, longitude: 77.209, timeZone: "Asia/Kolkata" },
  },
  settings: { zodiac: "sidereal", ayanamsha: "lahiri", chart: "D1", houseSystem: "whole_sign", nodeType: "mean", charaKarakaScheme: "seven_planet" },
  numerology: { lifePathMethod: "reduce_components", masterNumbers: "keep_11_22_33", yHandling: "consonant" },
  enabledRuleIds: [
    "naming.moon-pada-avakahada",
    "partner.seventh-lord-pada-avakahada",
    "partner.darakaraka-pada-avakahada",
    "numerology.life-path",
    "numerology.name-pythagorean",
  ],
  acknowledgeExperimental: true,
  name: "Asha Verma",
});

function post(body: unknown, init: { accept?: string; contentType?: string; raw?: string } = {}) {
  return new Request("http://localhost/api/v1/test", {
    method: "POST",
    headers: { "content-type": init.contentType ?? "application/json", ...(init.accept ? { accept: init.accept } : {}) },
    body: init.raw ?? JSON.stringify(body),
  });
}

beforeEach(() => {
  process.env.SHARE_TOKEN_SECRET = SECRET;
  resetConfigForTests();
  resetRateLimitersForTests();
});
afterEach(() => {
  delete process.env.SHARE_TOKEN_SECRET;
  resetConfigForTests();
  resetRateLimitersForTests();
});

describe("POST /api/v1/readings", () => {
  it("returns a completed reading envelope", async () => {
    const res = await readingsPOST(post(validReading()));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.status).toBe("completed");
    expect(body.data.partner.primary.syllable.roman).toBe("Ti");
    // Life Path 8; ASHA = 1+1+8+1 = 11 (kept), VERMA = 4+5+9+4+1 = 23 → 5: Expression 16 → 7;
    // Soul Urge (A,A | E,A) 2 + 6 = 8; Personality (S,H | V,R,M) 9 + 17→8 = 17 → 8.
    expect(body.data.numerology.results.map((n: { value: number }) => n.value)).toEqual([8, 7, 8, 8]);
  });

  it("streams genuine stage events then exactly one result", async () => {
    const res = await readingsPOST(post(validReading(), { accept: "application/x-ndjson" }));
    expect(res.headers.get("content-type")).toMatch(/application\/x-ndjson/);
    const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l) as ReadingStreamEvent);
    expect(events.filter((e) => e.type === "stage").map((e) => (e.type === "stage" ? e.stage : ""))).toEqual([
      "validate",
      "chart",
      "indicators",
      "numerology",
      "reading",
    ]);
    expect(events.at(-1)?.type).toBe("result");
    expect(events.filter((e) => e.type === "result")).toHaveLength(1);
  });

  it("streams a typed error (never a result) for an ambiguous local time", async () => {
    const body = validReading();
    body.birth = { ...body.birth, birthDate: "2021-11-07", birthTime: "01:30", place: { label: null as never, latitude: 40.71, longitude: -74, timeZone: "America/New_York" } };
    const json = await (await readingsPOST(post(body))).json();
    expect(json).toMatchObject({ ok: false, error: { code: "AMBIGUOUS_LOCAL_TIME" } });
    expect(json.error.details.earlier.offset).toBe("-04:00");

    const events = (await (await readingsPOST(post(body, { accept: "application/x-ndjson" }))).text())
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as ReadingStreamEvent);
    expect(events.some((e) => e.type === "result")).toBe(false);
    expect(events.at(-1)).toMatchObject({ type: "error", error: { code: "AMBIGUOUS_LOCAL_TIME" } });
  });

  it.each([
    ["impossible date", (b: ReturnType<typeof validReading>) => ({ ...b, birth: { ...b.birth, birthDate: "2023-02-29" } }), "birth.birthDate"],
    ["UTC offset instead of IANA zone", (b: ReturnType<typeof validReading>) => ({ ...b, birth: { ...b.birth, place: { ...b.birth.place, timeZone: "+05:30" } } }), "birth.place.timeZone"],
    ["latitude out of range", (b: ReturnType<typeof validReading>) => ({ ...b, birth: { ...b.birth, place: { ...b.birth.place, latitude: 95 } } }), "birth.place.latitude"],
    ["time marked known but missing", (b: ReturnType<typeof validReading>) => ({ ...b, birth: { ...b.birth, birthTime: null } }), "birth.birthTime"],
    ["experimental rules without acknowledgement", (b: ReturnType<typeof validReading>) => ({ ...b, acknowledgeExperimental: false }), "acknowledgeExperimental"],
    ["disabled method requested", (b: ReturnType<typeof validReading>) => ({ ...b, enabledRuleIds: [...b.enabledRuleIds, "partner.name-frequency-filter"] }), "enabledRuleIds.5"],
    ["unsupported house system", (b: ReturnType<typeof validReading>) => ({ ...b, settings: { ...b.settings, houseSystem: "placidus" } }), "settings.houseSystem"],
    ["name without a name method", (b: ReturnType<typeof validReading>) => ({ ...b, enabledRuleIds: ["numerology.life-path"] }), "name"],
    ["unknown extra field", (b: ReturnType<typeof validReading>) => ({ ...b, palmImage: "data:image/png;base64,AAAA" }), "_form"],
  ])("rejects %s with field errors", async (_label, mutate, field) => {
    const res = await readingsPOST(post(mutate(validReading())));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(body.error.fieldErrors)).toContain(field);
  });

  it("rejects malformed JSON, wrong content type and oversized bodies", async () => {
    expect((await readingsPOST(post(null, { raw: "{not json" }))).status).toBe(400);
    expect((await readingsPOST(post(validReading(), { contentType: "text/plain" }))).status).toBe(415);
    expect((await readingsPOST(post(null, { raw: JSON.stringify({ pad: "x".repeat(20_000) }) }))).status).toBe(413);
  });

  it("rate-limits calculation requests with Retry-After", async () => {
    setRateLimiterForTests("readings", new SlidingWindowRateLimiter({ limit: 1 }));
    expect((await readingsPOST(post(validReading()))).status).toBe(200);
    const res = await readingsPOST(post(validReading()));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
    expect((await res.json()).error.code).toBe("RATE_LIMITED");
  });
});

describe("POST /api/v1/chart and /api/v1/numerology", () => {
  it("returns a chart without any interpretation", async () => {
    const { birth, settings } = validReading();
    const body = await (await chartPOST(post({ birth, settings }))).json();
    expect(body.ok).toBe(true);
    expect(body.data.bodies).toHaveLength(9);
    expect(JSON.stringify(body.data)).not.toMatch(/syllable/i);
  });

  it("returns numerology on its own", async () => {
    const body = await (
      await numerologyPOST(
        post({
          birthDate: "1990-10-15",
          numerology: validReading().numerology,
          enabledRuleIds: ["numerology.life-path", "numerology.psychic-number"],
          name: null,
        }),
      )
    ).json();
    expect(body.data.results.map((r: { value: number }) => r.value)).toEqual([8, 6]);
  });
});

describe("GET /api/v1/rules", () => {
  it("publishes the registry, table and versions without secrets", async () => {
    const res = await rulesGET();
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.data.rules).toHaveLength(16);
    expect(body.data.avakahada.entries).toHaveLength(108);
    expect(body.data.versions.ruleSet).toMatch(/^soulletter-rules-/);
    expect(text).not.toContain(SECRET);
    expect(body.data.features.shareLinks.enabled).toBe(true);
  });
});

describe("privacy-safe sharing", () => {
  const share = (b: unknown) => sharePOST(post(b));
  const tokenGET = (token: string) => shareGET(new Request(`http://localhost/api/v1/share/${token}`), { params: Promise.resolve({ token }) });

  it("creates an opaque token whose public card contains no birth data", async () => {
    const res = await share({
      kind: "partner",
      items: [
        { cellId: "11-3", ruleIds: ["partner.seventh-lord-pada-avakahada"] },
        { cellId: "8-4", ruleIds: ["partner.darakaraka-pada-avakahada"] },
      ],
    });
    expect(res.status).toBe(201);
    const { data } = await res.json();
    expect(data.path).toBe(`/s/${data.token}`);
    expect(data.token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(data.token, "base64url").toString("latin1")).not.toMatch(/11-3|partner|Ti/);

    const card = await (await tokenGET(data.token)).json();
    expect(card.data.card.primary).toMatchObject({ roman: "Ti", devanagari: "टी" });
    const publicJson = JSON.stringify(card);
    for (const secret of ["1990", "14:30", "28.61", "77.20", "Kolkata", "Delhi", "Asha", "Verma", "Purva Phalguni"]) {
      expect(publicJson).not.toContain(secret);
    }
  });

  it("refuses birth data or unknown fields in a share request", async () => {
    const res = await share({ kind: "partner", items: [{ cellId: "11-3", ruleIds: ["partner.seventh-lord-pada-avakahada"] }], birthDate: "1990-10-15" });
    expect(res.status).toBe(422);
  });

  it("refuses ineligible rules and mismatched card kinds", async () => {
    expect((await share({ kind: "partner", items: [{ cellId: "11-3", ruleIds: ["partner.upapada-lagna"] }] })).status).toBe(422);
    expect((await share({ kind: "partner", items: [{ cellId: "11-3", ruleIds: ["numerology.life-path"] }] })).status).toBe(422);
    expect((await share({ kind: "native", items: [{ cellId: "11-3", ruleIds: ["partner.darakaraka-pada-avakahada"] }] })).status).toBe(422);
  });

  it("rejects tampered tokens and reports disabled sharing", async () => {
    const { data } = await (await share({ kind: "native", items: [{ cellId: "11-3", ruleIds: ["naming.moon-pada-avakahada"] }] })).json();
    const tampered = data.token.slice(0, -2) + (data.token.endsWith("A") ? "BB" : "AA");
    expect((await tokenGET(tampered)).status).toBe(404);
    expect((await tokenGET("not-a-token")).status).toBe(404);

    delete process.env.SHARE_TOKEN_SECRET;
    vi.stubEnv("NODE_ENV", "production");
    resetConfigForTests();
    try {
      expect((await share({ kind: "native", items: [{ cellId: "11-3", ruleIds: ["naming.moon-pada-avakahada"] }] })).status).toBe(503);
    } finally {
      vi.unstubAllEnvs();
      resetConfigForTests();
    }
  });
});
