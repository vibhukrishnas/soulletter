/**
 * Deterministic numerology service. Entertainment/symbolic context only.
 *
 * Numerology NEVER creates, removes, or reorders partner-syllable candidates; no
 * documented traditional rule maps a number to a future partner's initial (checked:
 * Cheiro, Balliett 1908, Decoz, numerology.com, AstroSage — 2026-10-13).
 *
 * Exact formulas (digitsum = sum of decimal digits):
 *   reduce(n, K)   = while n > 9 and n ∉ K: n = digitsum(n)
 *   K (masters)    = {11,22,33} | {11,22} | {} per the selected policy
 *   Life Path A    = reduce(reduce(month,K) + reduce(day,K) + reduce(year,K), K)   [Balliett 1908; Decoz]
 *   Life Path B    = reduce(sum of every digit of the date, K)                     [Cafe Astrology]
 *   Psychic/Mulank = reduce(day, {})                                                [Cheiro "birth number"; Prokerala]
 *   Destiny/Bhagyank = reduce(sum of every digit of DD MM YYYY, {})                 [AstroSage; 1–9 only]
 *   Pythagorean letter value = ((letter − 'A') mod 9) + 1                            [Balliett 1908 p.17]
 *   Expression / Soul Urge / Personality =
 *       reduce( Σ_words reduce(Σ letter values in word, K), K )                     [Decoz; per-name reduction]
 *       Soul Urge uses vowels A E I O U; Personality uses consonants; Y is a consonant (declared).
 *   Chaldean (Cheiro): word compound = Σ letter values; word single = reduce(compound, {});
 *       name compound = Σ word singles; name single = reduce(name compound, {})     [Cheiro, Book of Numbers pp.70–73]
 */
import type { NumerologySettings } from "@/lib/contracts/input";
import type {
  NumerologyNumber,
  NumerologyResult,
  NumerologyStep,
  NumerologyUnavailable,
} from "@/lib/contracts/numerology";
import type { EnableableRuleId } from "@/lib/rules/ids";

export const NUMEROLOGY_DISCLAIMER =
  "Numerology is a symbolic tradition, not a scientific measurement. These numbers are shown for reflection " +
  "and entertainment; they never create, remove or reorder the partner-syllable results.";

export function digitSum(n: number): number {
  if (!Number.isInteger(n) || n < 0) throw new RangeError("digitSum expects a non-negative integer");
  let s = 0;
  for (const ch of String(n)) s += Number(ch);
  return s;
}

export function masterSet(policy: NumerologySettings["masterNumbers"]): ReadonlySet<number> {
  if (policy === "keep_11_22_33") return new Set([11, 22, 33]);
  if (policy === "keep_11_22") return new Set([11, 22]);
  return new Set();
}

/** Reduces n by repeated digit sums, recording each step, stopping at a single digit or a kept master. */
export function reduceNumber(
  n: number,
  masters: ReadonlySet<number>,
  steps?: NumerologyStep[],
  label = "Reduce",
): number {
  let v = n;
  while (v > 9 && !masters.has(v)) {
    const next = digitSum(v);
    steps?.push({ label, expression: `${String(v).split("").join(" + ")} = ${next}`, result: next });
    v = next;
  }
  return v;
}

const THEMES: Record<number, string[]> = {
  1: ["independence", "initiative", "self-direction"],
  2: ["cooperation", "sensitivity", "partnership"],
  3: ["expression", "creativity", "sociability"],
  4: ["structure", "diligence", "stability"],
  5: ["freedom", "change", "curiosity"],
  6: ["care", "responsibility", "harmony"],
  7: ["reflection", "analysis", "introspection"],
  8: ["ambition", "organisation", "material focus"],
  9: ["compassion", "completion", "idealism"],
  11: ["intuition", "inspiration", "heightened sensitivity"],
  22: ["practical vision", "building", "large-scale goals"],
  33: ["compassionate guidance", "service", "teaching"],
};

export function themesFor(value: number): string[] {
  return THEMES[value] ?? [];
}

const PYTHAGOREAN_NOTE = "Pythagorean letter values: A=1 … I=9, J=1 … R=9, S=1 … Z=8.";
const CHALDEAN: Record<string, number> = {
  A: 1, I: 1, J: 1, Q: 1, Y: 1,
  B: 2, K: 2, R: 2,
  C: 3, G: 3, L: 3, S: 3,
  D: 4, M: 4, T: 4,
  E: 5, H: 5, N: 5, X: 5,
  U: 6, V: 6, W: 6,
  O: 7, Z: 7,
  F: 8, P: 8,
};
const CHALDEAN_NOTE =
  "Chaldean values (Cheiro): 1 A I J Q Y · 2 B K R · 3 C G L S · 4 D M T · 5 E H N X · 6 U V W · 7 O Z · 8 F P (no letter is 9).";
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export function pythagoreanValue(letter: string): number {
  const code = letter.charCodeAt(0) - 65;
  if (letter.length !== 1 || code < 0 || code > 25) throw new RangeError(`Not an A–Z letter: ${letter}`);
  return (code % 9) + 1;
}

export function chaldeanValue(letter: string): number {
  const v = CHALDEAN[letter];
  if (v === undefined) throw new RangeError(`Not an A–Z letter: ${letter}`);
  return v;
}

export type NameNormalization =
  | { ok: true; words: string[] }
  | { ok: false; reason: string };

/**
 * Normalization: Unicode NFKD, strip combining marks (é → E), upper-case; spaces and
 * hyphens separate words; apostrophes and periods are dropped. Any other character
 * (other scripts, digits, ß, Æ…) makes name numerology unavailable — we never
 * transliterate or guess.
 */
export function normalizeName(name: string): NameNormalization {
  const decomposed = name.normalize("NFKD").replace(/\p{M}+/gu, "");
  const stripped = decomposed.replace(/['’.]/g, "").trim();
  if (stripped.length === 0) return { ok: false, reason: "The name contains no letters." };
  // Validate BEFORE upper-casing: "ß".toUpperCase() is "SS", which would be a silent transliteration.
  if (!/^[A-Za-z\s-]+$/.test(stripped)) {
    return {
      ok: false,
      reason:
        "Name numerology uses the 26-letter Latin alphabet. This name contains other characters, and we do not transliterate automatically.",
    };
  }
  const words = stripped.toUpperCase().split(/[\s-]+/).filter(Boolean);
  return { ok: true, words };
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function parseDate(iso: string): DateParts {
  const [y, m, d] = iso.split("-").map(Number);
  return { year: y, month: m, day: d };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function lifePath(
  date: DateParts,
  method: NumerologySettings["lifePathMethod"],
  masters: ReadonlySet<number>,
): { value: number; steps: NumerologyStep[] } {
  const steps: NumerologyStep[] = [];
  if (method === "reduce_components") {
    const m = reduceNumber(date.month, masters, steps, "Month");
    const d = reduceNumber(date.day, masters, steps, "Day");
    const yd = digitSum(date.year);
    steps.push({ label: "Year", expression: `${String(date.year).split("").join(" + ")} = ${yd}`, result: yd });
    const y = reduceNumber(yd, masters, steps, "Year");
    const total = m + d + y;
    steps.push({ label: "Sum of components", expression: `${m} + ${d} + ${y} = ${total}`, result: total });
    return { value: reduceNumber(total, masters, steps), steps };
  }
  const digits = `${date.year}${pad2(date.month)}${pad2(date.day)}`.split("").map(Number);
  const total = digits.reduce((a, b) => a + b, 0);
  steps.push({ label: "Sum of all digits", expression: `${digits.join(" + ")} = ${total}`, result: total });
  return { value: reduceNumber(total, masters, steps), steps };
}

function wordNumbers(
  words: string[],
  letterValue: (l: string) => number,
  include: (letter: string) => boolean,
  masters: ReadonlySet<number>,
  steps: NumerologyStep[],
): number {
  const singles: number[] = [];
  for (const word of words) {
    const letters = [...word].filter(include);
    if (letters.length === 0) continue;
    const values = letters.map(letterValue);
    const sum = values.reduce((a, b) => a + b, 0);
    steps.push({
      label: word,
      expression: `${letters.map((l, i) => `${l}=${values[i]}`).join(" + ")} = ${sum}`,
      result: sum,
    });
    singles.push(reduceNumber(sum, masters, steps, word));
  }
  const total = singles.reduce((a, b) => a + b, 0);
  steps.push({ label: "Sum of words", expression: `${singles.join(" + ") || "0"} = ${total}`, result: total });
  return reduceNumber(total, masters, steps);
}

function numberResult(
  ruleId: EnableableRuleId,
  name: string,
  value: number,
  masters: ReadonlySet<number>,
  steps: NumerologyStep[],
  formula: string,
  convention: string,
  compound: number | null = null,
): NumerologyNumber {
  return {
    ruleId,
    name,
    value,
    isMasterNumber: value > 9 && masters.has(value),
    compound,
    steps,
    formula,
    convention,
    themes: themesFor(value),
  };
}

function masterLabel(policy: NumerologySettings["masterNumbers"]): string {
  return policy === "keep_11_22_33"
    ? "master numbers 11, 22 and 33 are kept"
    : policy === "keep_11_22"
      ? "master numbers 11 and 22 are kept (33 is reduced)"
      : "all numbers are reduced to a single digit";
}

export interface NumerologyInput {
  birthDate: string;
  settings: NumerologySettings;
  enabledRuleIds: readonly string[];
  name: string | null;
}

export function computeNumerology(input: NumerologyInput): NumerologyResult {
  const { settings } = input;
  const enabled = new Set(input.enabledRuleIds.filter((id) => id.startsWith("numerology.")));
  const base = {
    settings,
    candidatePolicy: "numerology_never_generates_or_ranks_candidates" as const,
    disclaimer: NUMEROLOGY_DISCLAIMER,
  };
  if (enabled.size === 0) return { ...base, status: "not_requested", results: [], unavailable: [] };

  const date = parseDate(input.birthDate);
  const K = masterSet(settings.masterNumbers);
  const none = masterSet("none");
  const results: NumerologyNumber[] = [];
  const unavailable: NumerologyUnavailable[] = [];
  const masterText = masterLabel(settings.masterNumbers);

  if (enabled.has("numerology.life-path")) {
    const lp = lifePath(date, settings.lifePathMethod, K);
    results.push(
      numberResult(
        "numerology.life-path",
        "Life Path Number",
        lp.value,
        K,
        lp.steps,
        settings.lifePathMethod === "reduce_components"
          ? "Reduce the month, day and year separately, add them, then reduce the total."
          : "Add every digit of the birth date, then reduce the total.",
        `Gregorian birth date; ${masterText}.`,
      ),
    );
  }

  if (enabled.has("numerology.psychic-number")) {
    const steps: NumerologyStep[] = [{ label: "Day of birth", expression: String(date.day), result: date.day }];
    const v = reduceNumber(date.day, none, steps);
    results.push(
      numberResult(
        "numerology.psychic-number",
        "Psychic Number (Mulank)",
        v,
        none,
        steps,
        "Reduce the day of the month to a single digit.",
        "Indian numerology convention: always 1–9, no master numbers.",
      ),
    );
  }

  if (enabled.has("numerology.destiny-number")) {
    const digits = `${pad2(date.day)}${pad2(date.month)}${date.year}`.split("").map(Number);
    const total = digits.reduce((a, b) => a + b, 0);
    const steps: NumerologyStep[] = [
      { label: "Sum of all digits (DD MM YYYY)", expression: `${digits.join(" + ")} = ${total}`, result: total },
    ];
    const v = reduceNumber(total, none, steps);
    results.push(
      numberResult(
        "numerology.destiny-number",
        "Destiny Number (Bhagyank)",
        v,
        none,
        steps,
        "Add every digit of the full birth date and reduce to a single digit.",
        "Indian numerology convention used by AstroSage: always 1–9 (some calculators keep 11/22/33; not applied here).",
      ),
    );
  }

  const nameMethods = ["numerology.name-pythagorean", "numerology.name-chaldean"].filter((id) => enabled.has(id)) as EnableableRuleId[];
  if (nameMethods.length > 0) {
    const normalized = input.name === null ? ({ ok: false, reason: "No name was provided." } as const) : normalizeName(input.name);
    if (!normalized.ok) {
      for (const ruleId of nameMethods) unavailable.push({ ruleId, reason: normalized.reason });
    } else {
      const { words } = normalized;
      if (enabled.has("numerology.name-pythagorean")) {
        const variants: [string, (l: string) => boolean, string][] = [
          ["Expression Number", () => true, "all letters"],
          ["Soul Urge Number", (l) => VOWELS.has(l), "vowels A, E, I, O, U"],
          ["Personality Number", (l) => !VOWELS.has(l), "consonants (Y counted as a consonant)"],
        ];
        for (const [title, include, scope] of variants) {
          const steps: NumerologyStep[] = [];
          const v = wordNumbers(words, pythagoreanValue, include, K, steps);
          results.push(
            numberResult(
              "numerology.name-pythagorean",
              `${title} (Pythagorean)`,
              v,
              K,
              steps,
              `Sum the Pythagorean values of the ${scope} in each name, reduce each name, add the names, then reduce.`,
              `${PYTHAGOREAN_NOTE} Accents removed; ${masterText}.`,
            ),
          );
        }
      }
      if (enabled.has("numerology.name-chaldean")) {
        const steps: NumerologyStep[] = [];
        const singles = words.map((word) => {
          const values = [...word].map(chaldeanValue);
          const compound = values.reduce((a, b) => a + b, 0);
          steps.push({
            label: word,
            expression: `${[...word].map((l, i) => `${l}=${values[i]}`).join(" + ")} = ${compound}`,
            result: compound,
          });
          return reduceNumber(compound, none, steps, word);
        });
        const compound = singles.reduce((a, b) => a + b, 0);
        steps.push({ label: "Compound (sum of names)", expression: `${singles.join(" + ")} = ${compound}`, result: compound });
        const v = reduceNumber(compound, none, steps);
        results.push(
          numberResult(
            "numerology.name-chaldean",
            "Name Number (Chaldean)",
            v,
            none,
            steps,
            "Sum each name's Chaldean letter values, reduce each name, add the single numbers to get the compound number, then reduce.",
            `${CHALDEAN_NOTE} Compound number kept for reference; final value 1–9.`,
            compound,
          ),
        );
      }
    }
  }

  return { ...base, status: "calculated", results, unavailable };
}
