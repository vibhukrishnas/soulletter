import { describe, expect, it } from "vitest";
import { NAKSHATRAS, padaBoundaryDeg } from "@/lib/astro/zodiac";
// Copy of soulletter_audit_artifacts/avakahada_mapping.json (the audit package is kept outside the repo).
import auditMapping from "../../../tests/reference/fixtures/audit-avakahada-mapping.json";
import {
  AVAKAHADA_ENTRIES,
  AVAKAHADA_SOURCES,
  AVAKAHADA_TABLE,
  syllableForCellId,
  syllableForLongitude,
  syllableForPadaIndex,
} from "./table";
import { devanagariSyllableToIast } from "./transliterate";

describe("Avakahada table completeness", () => {
  it("has exactly 27 × 4 = 108 cells in Nakshatra/Pada order", () => {
    expect(AVAKAHADA_ENTRIES).toHaveLength(108);
    AVAKAHADA_ENTRIES.forEach((e, i) => {
      expect(e.padaIndex).toBe(i);
      expect(e.nakshatraIndex).toBe(Math.floor(i / 4));
      expect(e.pada).toBe((i % 4) + 1);
      expect(e.nakshatraName).toBe(NAKSHATRAS[e.nakshatraIndex].name);
      expect(e.cellId).toBe(`${e.nakshatraIndex + 1}-${e.pada}`);
    });
  });

  it("gives every cell a Roman spelling, Devanagari, IAST, sources and a provisional status", () => {
    for (const e of AVAKAHADA_ENTRIES) {
      expect(e.roman).toMatch(/^[A-Z][a-z]*$/);
      expect(e.devanagari).toMatch(/^[ऀ-ॿ]+$/);
      expect(e.iast).toBe(devanagariSyllableToIast(e.devanagari));
      expect(e.phoneticKey).toBe(e.iast);
      expect(e.latinInitial).toBe(e.roman[0]);
      expect(e.sourceIds.length).toBeGreaterThanOrEqual(3);
      expect(e.status).toBe("provisional_secondary_source");
      for (const id of e.sourceIds) expect(AVAKAHADA_SOURCES.map((s) => s.id)).toContain(id);
    }
  });

  it("is never labelled as verified or production-canonical", () => {
    expect(AVAKAHADA_TABLE.status).toBe("provisional_secondary_source");
    expect(AVAKAHADA_TABLE.primaryClassicalSourceVerified).toBe(false);
  });

  it("matches the audit package's provisional Roman table cell by cell", () => {
    const audit = auditMapping.nakshatras.flatMap((n) => n.padas.map((p) => p.syllableRoman));
    expect(AVAKAHADA_ENTRIES.map((e) => e.roman)).toEqual(audit);
  });

  it("is frozen so the data cannot be mutated at runtime", () => {
    expect(Object.isFrozen(AVAKAHADA_ENTRIES)).toBe(true);
  });
});

describe("phonetic distinctions are preserved", () => {
  it("keeps retroflex and dental syllables apart even when the Roman spelling is identical", () => {
    const ta = AVAKAHADA_ENTRIES.filter((e) => e.roman === "Ta");
    expect(ta.map((e) => [e.cellId, e.devanagari, e.iast])).toEqual([
      ["11-2", "टा", "ṭā"],
      ["15-4", "ता", "tā"],
    ]);
    const da = AVAKAHADA_ENTRIES.filter((e) => e.roman === "Da");
    expect(new Set(da.map((e) => e.phoneticKey)).size).toBe(2);
  });

  it("keeps rare nasal syllables exactly as published (no substitution)", () => {
    expect(syllableForCellId("6-3")).toMatchObject({ roman: "Nga", devanagari: "ङ", iast: "ṅa" });
    expect(syllableForCellId("13-3")).toMatchObject({ roman: "Na", devanagari: "ण", iast: "ṇa" });
    expect(syllableForCellId("26-4")).toMatchObject({ roman: "Nya", devanagari: "ञ", iast: "ña" });
    expect(syllableForCellId("26-4")?.variantNote).toMatch(/Tra/);
  });

  it("records the Shravana regional variant without merging it", () => {
    const shravana = AVAKAHADA_ENTRIES.filter((e) => e.nakshatraName === "Shravana");
    expect(shravana.map((e) => e.roman)).toEqual(["Khi", "Khu", "Khe", "Kho"]);
    for (const e of shravana) {
      expect(e.variantNote).toMatch(/Ju, Je, Jo, Gha/);
      expect(e.sourceIds).not.toContain("S2");
    }
  });
});

describe("lookup", () => {
  it("returns the exact cell for each Pada index and null for invalid indices", () => {
    expect(syllableForPadaIndex(42)?.roman).toBe("Ti");
    expect(syllableForPadaIndex(-1)).toBeNull();
    expect(syllableForPadaIndex(108)).toBeNull();
    expect(syllableForPadaIndex(3.5)).toBeNull();
    expect(syllableForCellId("28-1")).toBeNull();
  });

  it("maps longitudes at every Pada boundary to the following cell", () => {
    for (let k = 0; k < 108; k++) {
      expect(syllableForLongitude(padaBoundaryDeg(k)).padaIndex).toBe(k);
    }
    expect(syllableForLongitude(359.9999999).cellId).toBe("27-4");
  });

  it("gives the reference-case syllables", () => {
    // Moon (and seventh lord) at 140.1148° → Purva Phalguni 3 → Ti (टी)
    expect(syllableForLongitude(140.114753711)).toMatchObject({ roman: "Ti", devanagari: "टी", iast: "ṭī" });
    // Jupiter just past 106°40′ (Swiss) → Ashlesha 1 → Di; just before (astronomy-engine) → Pushya 4 → Da
    expect(syllableForLongitude(106.666967083).roman).toBe("Di");
    expect(syllableForLongitude(106.666562581).roman).toBe("Da");
  });
});

describe("transliteration", () => {
  it.each([
    ["चु", "cu"],
    ["छ", "cha"],
    ["ष", "ṣa"],
    ["ण", "ṇa"],
    ["ठ", "ṭha"],
    ["ङ", "ṅa"],
    ["ञ", "ña"],
    ["ढा", "ḍhā"],
    ["दा", "dā"],
    ["आ", "ā"],
    ["ऊ", "ū"],
  ])("%s → %s", (dev, iast) => {
    expect(devanagariSyllableToIast(dev)).toBe(iast);
  });

  it("rejects unexpected input instead of guessing", () => {
    expect(() => devanagariSyllableToIast("क्ष")).toThrow();
    expect(() => devanagariSyllableToIast("Ka")).toThrow();
  });
});
