/**
 * Avakahada Chakra — Nakshatra-Pada naming syllables (27 × 4 = 108 cells).
 *
 * STATUS: provisional, secondary sources only. No primary classical text establishing a
 * single canonical table was verified. The selected variant follows the most common
 * modern published table; regional variants are recorded per cell and are NEVER merged
 * or substituted at lookup time.
 *
 * Provenance (checked 2026-10-13):
 *  - Roman spellings: S1 (full table). S2 agrees on 106 of 108 cells; it differs on
 *    Shravana (Ju/Je/Jo/Gha) and Uttara Bhadrapada Pada 4 (Tra). S3 also documents the
 *    Shravana Ju/Je/Jo/Gha variant (cited by the audit package).
 *  - Devanagari: D1 (full Pada-wise Hindi table). D2 (per-sign Hindi lists) agrees on the
 *    consonant of all 108 cells and differs only in vowel length / inherent vowel in 8
 *    cells, recorded below.
 *  - IAST is derived from the selected Devanagari by a tested transliterator.
 *
 * This table supports the user's OWN traditional naming syllable. Mapping a partner
 * significator onto it is an experimental modern symbolic reading, not a classical rule.
 */
import { NAKSHATRAS, padaIndexOf } from "@/lib/astro/zodiac";
import type { SyllableEntry } from "@/lib/contracts/reading";
import { devanagariSyllableToIast } from "./transliterate";

export const AVAKAHADA_TABLE_VERSION = "avakahada-secondary-2026.10.1";

export interface AvakahadaSource {
  id: "S1" | "S2" | "S3" | "D1" | "D2";
  label: string;
  url: string;
  supports: string;
  accessed: string;
}

export const AVAKAHADA_SOURCES: readonly AvakahadaSource[] = [
  {
    id: "S1",
    label: "AstrologyHindi — Baby names by Nakshatra (complete syllable table)",
    url: "https://astrologyhindi.in/en/articles/baby-names-by-nakshatra/",
    supports: "All 108 Roman syllables of the selected variant (incl. Shravana Khi/Khu/Khe/Kho, Uttara Bhadrapada 4 Nya).",
    accessed: "2026-10-13",
  },
  {
    id: "S2",
    label: "Nitya Deepam — Baby name syllables by Nakshatra Pada",
    url: "https://www.nityadeepam.com/en/tools/baby-names/",
    supports: "Roman cross-check; matches S1 except Shravana (Ju, Je, Jo, Gha) and Uttara Bhadrapada 4 (Tra).",
    accessed: "2026-10-13",
  },
  {
    id: "S3",
    label: "Live Panditji — Shravana Nakshatra names (Ju, Je, Jo, Gha)",
    url: "https://www.livepanditji.com/baby-names/shravana/",
    supports: "Documents the alternative Shravana syllables (as cited in the SoulLetter audit package).",
    accessed: "2026-10-13",
  },
  {
    id: "D1",
    label: "OnlineJyotish (Hindi) — नक्षत्र चरणों के अनुसार नामाक्षर तालिका",
    url: "https://www.onlinejyotish.com/hindi-astrology/astrology-lessons/lesson_3.php",
    supports: "All 108 Devanagari syllables, Pada by Pada (selected Devanagari forms).",
    accessed: "2026-10-13",
  },
  {
    id: "D2",
    label: "Shubh Panchang (Hindi) — नक्षत्र (per-sign Nakshatra-charana letters)",
    url: "https://shubhpanchang.com/hi/hindu-cosmology/nakshtra",
    supports: "Devanagari cross-check: same consonant in all 108 cells; vowel-length differences in 8 cells.",
    accessed: "2026-10-13",
  },
];

type Cell = readonly [roman: string, devanagari: string, d2Variant?: string];

// Nakshatra order 1..27, Padas 1..4.
const ROWS: readonly (readonly [Cell, Cell, Cell, Cell])[] = [
  [["Chu", "चु", "चू"], ["Che", "चे"], ["Cho", "चो"], ["La", "ला"]],
  [["Li", "ली"], ["Lu", "लू"], ["Le", "ले"], ["Lo", "लो"]],
  [["A", "आ", "अ"], ["I", "ई"], ["U", "ऊ", "उ"], ["E", "ए"]],
  [["O", "ओ"], ["Va", "वा"], ["Vi", "वी"], ["Vu", "वु", "वू"]],
  [["Ve", "वे"], ["Vo", "वो"], ["Ka", "का"], ["Ki", "की"]],
  [["Ku", "कु"], ["Gha", "घ"], ["Nga", "ङ"], ["Chha", "छ"]],
  [["Ke", "के"], ["Ko", "को"], ["Ha", "हा"], ["Hi", "ही"]],
  [["Hu", "हु"], ["He", "हे"], ["Ho", "हो"], ["Da", "डा"]],
  [["Di", "डी"], ["Du", "डू"], ["De", "डे"], ["Do", "डो"]],
  [["Ma", "मा"], ["Mi", "मी"], ["Mu", "मू"], ["Me", "मे"]],
  [["Mo", "मो"], ["Ta", "टा"], ["Ti", "टी"], ["Tu", "टू"]],
  [["Te", "टे"], ["To", "टो"], ["Pa", "पा"], ["Pi", "पी"]],
  [["Pu", "पू"], ["Sha", "ष"], ["Na", "ण"], ["Tha", "ठ"]],
  [["Pe", "पे"], ["Po", "पो"], ["Ra", "रा"], ["Ri", "री"]],
  [["Ru", "रू", "रु"], ["Re", "रे"], ["Ro", "रो"], ["Ta", "ता"]],
  [["Ti", "ती"], ["Tu", "तू"], ["Te", "ते"], ["To", "तो"]],
  [["Na", "ना"], ["Ni", "नी"], ["Nu", "नू"], ["Ne", "ने"]],
  [["No", "नो"], ["Ya", "या"], ["Yi", "यी"], ["Yu", "यू"]],
  [["Ye", "ये"], ["Yo", "यो"], ["Bha", "भा"], ["Bhi", "भी"]],
  [["Bhu", "भू"], ["Dha", "धा"], ["Pha", "फा"], ["Dha", "ढा", "ढ"]],
  [["Bhe", "भे"], ["Bho", "भो"], ["Ja", "जा"], ["Ji", "जी"]],
  [["Khi", "खी"], ["Khu", "खू"], ["Khe", "खे"], ["Kho", "खो"]],
  [["Ga", "गा"], ["Gi", "गी"], ["Gu", "गू", "गु"], ["Ge", "गे"]],
  [["Go", "गो"], ["Sa", "सा"], ["Si", "सी"], ["Su", "सू"]],
  [["Se", "से"], ["So", "सो"], ["Da", "दा"], ["Di", "दी"]],
  [["Du", "दू"], ["Tha", "थ"], ["Jha", "झ"], ["Nya", "ञ"]],
  [["De", "दे"], ["Do", "दो"], ["Cha", "चा", "च"], ["Chi", "ची"]],
];

/** Variant notes beyond Devanagari vowel length, keyed by "<nakshatra>-<pada>". */
const EXTRA_NOTES: Record<string, string> = {
  "6-3": "Romanized variously as Nga, Ng, Ing or Na in modern lists; the Devanagari ङ is a velar nasal that rarely begins modern names. Shown as published, never replaced.",
  "13-2": "ष is the retroflex sibilant (ṣa); it is a different sound from श (śa) and स (sa).",
  "13-3": "ण is the retroflex nasal (ṇa), distinct from the dental न (na) of Anuradha.",
  "22-1": "Shravana variant: S2 and S3 list Ju, Je, Jo, Gha for Padas 1–4 instead of Khi, Khu, Khe, Kho.",
  "22-2": "Shravana variant: S2 and S3 list Ju, Je, Jo, Gha for Padas 1–4 instead of Khi, Khu, Khe, Kho.",
  "22-3": "Shravana variant: S2 and S3 list Ju, Je, Jo, Gha for Padas 1–4 instead of Khi, Khu, Khe, Kho.",
  "22-4": "Shravana variant: S2 and S3 list Ju, Je, Jo, Gha for Padas 1–4 instead of Khi, Khu, Khe, Kho.",
  "26-4": "Variant: S2 lists Tra for this Pada; ञ is a palatal nasal (ña) that rarely begins modern names. Shown as published, never replaced.",
};

function buildEntries(): SyllableEntry[] {
  if (ROWS.length !== 27) throw new Error("Avakahada table must have 27 rows");
  const entries: SyllableEntry[] = [];
  ROWS.forEach((row, n) => {
    row.forEach(([roman, devanagari, d2Variant], p) => {
      const pada = (p + 1) as 1 | 2 | 3 | 4;
      const cellId = `${n + 1}-${pada}`;
      const iast = devanagariSyllableToIast(devanagari);
      const notes: string[] = [];
      if (d2Variant) {
        notes.push(
          `Devanagari vowel-length variant: D2 writes ${d2Variant} (${devanagariSyllableToIast(d2Variant)}); D1 writes ${devanagari} (${iast}).`,
        );
      }
      if (EXTRA_NOTES[cellId]) notes.push(EXTRA_NOTES[cellId]);
      const sourceIds = ["S1", "D1", "D2"];
      if (!(n === 21 || cellId === "26-4")) sourceIds.splice(1, 0, "S2");
      entries.push({
        cellId,
        nakshatraIndex: n,
        nakshatraName: NAKSHATRAS[n].name,
        pada,
        padaIndex: n * 4 + p,
        roman,
        devanagari,
        iast,
        latinInitial: roman.charAt(0).toUpperCase(),
        phoneticKey: iast,
        sourceIds,
        status: "provisional_secondary_source",
        variantNote: notes.length > 0 ? notes.join(" ") : null,
      });
    });
  });
  return entries;
}

export const AVAKAHADA_ENTRIES: readonly SyllableEntry[] = Object.freeze(buildEntries());

export const AVAKAHADA_TABLE = {
  version: AVAKAHADA_TABLE_VERSION,
  title: "Avakahada Chakra naming syllables (modern secondary-source variant)",
  status: "provisional_secondary_source" as const,
  selectedVariant: "Khi/Khu/Khe/Kho for Shravana; Nya for Uttara Bhadrapada Pada 4 (S1)",
  primaryClassicalSourceVerified: false,
  approvedUse:
    "Lookup of a person's own traditional naming syllable; experimental symbolic partner readings only when explicitly enabled and labelled.",
  sources: AVAKAHADA_SOURCES,
  entryCount: 108,
} as const;

/**
 * Exact table cell for a global Pada index (0..107). Returns null only for an invalid
 * index. There is no fallback, substitution, or frequency filtering of any kind.
 */
export function syllableForPadaIndex(padaIndex: number): SyllableEntry | null {
  if (!Number.isInteger(padaIndex) || padaIndex < 0 || padaIndex >= AVAKAHADA_ENTRIES.length) return null;
  return AVAKAHADA_ENTRIES[padaIndex];
}

export function syllableForLongitude(siderealLongitudeDeg: number): SyllableEntry {
  return AVAKAHADA_ENTRIES[padaIndexOf(siderealLongitudeDeg)];
}

export function syllableForCellId(cellId: string): SyllableEntry | null {
  return AVAKAHADA_ENTRIES.find((e) => e.cellId === cellId) ?? null;
}
