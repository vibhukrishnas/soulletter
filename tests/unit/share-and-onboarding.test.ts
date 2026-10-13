import { describe, expect, it } from "vitest";
import {
  INITIAL_VALUES,
  enabledRuleIds,
  toReadingRequest,
  validateRequest,
  validateStep,
  type OnboardingValues,
} from "@/lib/client/onboarding";
import { readingRequestSchema } from "@/lib/contracts/input";
import { buildShareCard, fromTokenPayload, shareCardText, toTokenPayload } from "@/lib/share/card";

const complete = (over: Partial<OnboardingValues> = {}): OnboardingValues => ({
  ...INITIAL_VALUES,
  name: "Asha",
  birthDate: "1990-10-15",
  birthTimeKnown: true,
  birthTime: "14:30",
  placeMode: "search",
  placeLabel: "New Delhi, Delhi, India",
  latitude: "28.6139",
  longitude: "77.2090",
  timeZone: "Asia/Kolkata",
  acknowledgeExperimental: true,
  ...over,
});

describe("onboarding → request", () => {
  it("produces a request the server schema accepts", () => {
    const req = toReadingRequest(complete());
    expect(readingRequestSchema.safeParse(req).success).toBe(true);
    expect(validateRequest(req)).toEqual({});
  });

  it("never sends the name unless a name-based method is selected", () => {
    expect(toReadingRequest(complete()).name).toBeNull();
    const withName = toReadingRequest(complete({ methods: { ...INITIAL_VALUES.methods, namePythagorean: true } }));
    expect(withName.name).toBe("Asha");
  });

  it("drops time and accuracy when the birth time is unknown", () => {
    const req = toReadingRequest(complete({ birthTimeKnown: false, birthTime: "14:30" }));
    expect(req.birth).toMatchObject({ birthTimeKnown: false, birthTime: null, birthTimeAccuracy: null });
  });

  it("sends only the time zone in time-zone-only mode and nothing when skipped", () => {
    expect(toReadingRequest(complete({ placeMode: "time_zone_only" })).birth.place).toEqual({
      label: null,
      latitude: null,
      longitude: null,
      timeZone: "Asia/Kolkata",
    });
    expect(toReadingRequest(complete({ placeMode: "skip" })).birth.place).toEqual({
      label: null,
      latitude: null,
      longitude: null,
      timeZone: null,
    });
  });

  it("does not guess unanswered questions", () => {
    const e = validateStep("birth", { ...INITIAL_VALUES, birthDate: "1990-10-15" });
    expect(e.birthTimeKnown).toBeDefined();
    expect(e.placeMode).toBeDefined();
  });

  it("requires the experimental acknowledgement only when partner rules are on", () => {
    expect(validateStep("preferences", complete({ acknowledgeExperimental: false })).acknowledgeExperimental).toBeDefined();
    const off = complete({ acknowledgeExperimental: false, methods: { ...INITIAL_VALUES.methods, partnerSeventhLord: false, partnerDarakaraka: false } });
    expect(validateStep("preferences", off)).toEqual({});
    expect(toReadingRequest(off).acknowledgeExperimental).toBe(false);
  });

  it("rejects impossible input before calling the server", () => {
    expect(validateStep("profile", complete({ birthDate: "2023-02-29" })).birthDate).toBeDefined();
    expect(validateStep("profile", complete({ birthDate: "2999-01-01" })).birthDate).toBeDefined();
    expect(validateStep("birth", complete({ latitude: "abc" })).latitude).toBeDefined();
    expect(validateStep("birth", complete({ timeZone: "+05:30" })).timeZone).toBeDefined();
  });

  it("maps every toggle to a registered rule id", () => {
    const all = Object.fromEntries(Object.keys(INITIAL_VALUES.methods).map((k) => [k, true])) as unknown as OnboardingValues["methods"];
    expect(enabledRuleIds(all)).toHaveLength(8);
  });
});

describe("share card", () => {
  const partner = {
    kind: "partner" as const,
    items: [
      { cellId: "11-3", ruleIds: ["partner.seventh-lord-pada-avakahada"] },
      { cellId: "8-4", ruleIds: ["partner.darakaraka-pada-avakahada"] },
    ],
  };

  it("builds a card from table cells and registry rules only", () => {
    const r = buildShareCard(partner);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.card.primary).toEqual({ cellId: "11-3", roman: "Ti", devanagari: "टी", iast: "ṭī" });
    expect(r.card.alternatives.map((a) => a.roman)).toEqual(["Da"]);
    expect(r.card.methods.every((m) => m.statusLabel === "Experimental symbolic interpretation")).toBe(true);
    expect(r.card.disclaimer).toMatch(/not a prediction/);
  });

  it("round-trips through the compact token payload", () => {
    expect(fromTokenPayload(toTokenPayload(partner))).toEqual(partner);
    expect(fromTokenPayload({ v: 2 })).toBeNull();
    expect(fromTokenPayload({ v: 1, k: "p", i: [["11-3", "nope"]] })).toBeNull();
  });

  it("produces copy text without any personal data", () => {
    const r = buildShareCard(partner);
    if (!r.ok) throw new Error();
    const text = shareCardText(r.card, "https://example.test/s/abc");
    expect(text).toContain("Ti (टी, ṭī)");
    expect(text).toContain("https://example.test/s/abc");
    expect(text).not.toMatch(/Purva|Phalguni|Pushya|Ashlesha|1990|14:30|Delhi|Kolkata|Asha\b/);
  });

  it("rejects unknown cells, mismatched kinds and excluded rules", () => {
    expect(buildShareCard({ kind: "partner", items: [{ cellId: "11-3", ruleIds: ["partner.palm-feature-fusion"] }] }).ok).toBe(false);
    expect(buildShareCard({ kind: "native", items: partner.items }).ok).toBe(false);
    expect(buildShareCard({ kind: "partner", items: [{ cellId: "11-3", ruleIds: ["naming.moon-pada-avakahada"] }] }).ok).toBe(false);
  });
});
