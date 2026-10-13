/**
 * Versioned interpretation registry. Every method the product can show — and every
 * method it deliberately refuses to implement — is registered here with its source,
 * procedure, inputs, mapping, verification status and limitations.
 *
 * A rule can only produce candidates when it is enabled, registered with a supported
 * candidate mapping, and passes validateRegistry(). Disabled rules never emit.
 */
import { AVAKAHADA_TABLE_VERSION } from "@/lib/avakahada/table";
import type { VerificationStatus } from "@/lib/contracts/reading";
import { ENABLEABLE_RULE_IDS, EXCLUDED_RULE_IDS, type RuleId } from "./ids";

export const RULE_SET_VERSION = "soulletter-rules-2026.10.1";

export type InputRequirement = "birth_date" | "time_zone" | "birth_time" | "coordinates" | "name";
export type RuleCategory = "native_naming_reference" | "partner_symbolic" | "numerology" | "excluded";
export type OutputType = "naming_syllable" | "syllable_candidate" | "number" | "none";
export type MappingPoint = "moon" | "seventh_house_lord" | "darakaraka";

export interface CandidateMapping {
  table: "avakahada";
  tableVersion: string;
  point: MappingPoint;
}

export interface RuleDefinition {
  id: RuleId;
  name: string;
  tradition: string;
  category: RuleCategory;
  source: string;
  /** Only URLs that were actually checked; null otherwise. */
  sourceUrl: string | null;
  version: string;
  inputRequirements: readonly InputRequirement[];
  calculationProcedure: string;
  outputType: OutputType;
  candidateMapping: CandidateMapping | null;
  verificationStatus: VerificationStatus;
  limitations: readonly string[];
  enabled: boolean;
  /** Presentation order among partner rules (1 = first). Not a confidence rank. */
  displayOrder: number | null;
  /** Short symbolic text that may appear on a share card. */
  shareInterpretation: string | null;
  /** Audit claim ids (soulletter_audit_artifacts/claim_audit.csv) that shaped this entry. */
  auditRefs: readonly string[];
}

const AVAKAHADA_LIMITATION =
  "Uses a provisional Avakahada table compiled from modern secondary sources; regional tables differ (e.g. Shravana) and no primary classical text was verified.";

export const RULES: readonly RuleDefinition[] = [
  {
    id: "naming.moon-pada-avakahada",
    name: "Your traditional naming syllable (Moon Nakshatra Pada)",
    tradition: "Jyotisha naming convention (nāmākṣara via the Avakahada Chakra)",
    category: "native_naming_reference",
    source: "Modern panchang/naming tables (see the Avakahada table sources S1, S2, D1, D2)",
    sourceUrl: "https://www.onlinejyotish.com/hindi-astrology/astrology-lessons/lesson_3.php",
    version: "1.0.0",
    inputRequirements: ["birth_date", "time_zone", "birth_time"],
    calculationProcedure:
      "Sidereal (Lahiri) Moon longitude λ → Nakshatra = ⌊λ / 13°20′⌋, Pada = ⌊(λ mod 13°20′) / 3°20′⌋ + 1 → the table cell for that Nakshatra Pada.",
    outputType: "naming_syllable",
    candidateMapping: { table: "avakahada", tableVersion: AVAKAHADA_TABLE_VERSION, point: "moon" },
    verificationStatus: "documented_traditional_interpretation",
    limitations: [
      "This is the traditional syllable associated with YOUR birth Nakshatra Pada. It is not a prediction about a partner.",
      AVAKAHADA_LIMITATION,
      "The Moon changes Pada roughly every six hours, so an unknown or approximate birth time can change the syllable.",
    ],
    enabled: true,
    displayOrder: null,
    shareInterpretation: "The traditional naming syllable linked to a birth Nakshatra Pada.",
    auditRefs: ["C010", "C017"],
  },
  {
    id: "partner.seventh-lord-pada-avakahada",
    name: "Seventh-house lord's Nakshatra Pada (experimental)",
    tradition: "Modern symbolic adaptation combining Parashari house lordship with the Avakahada table",
    category: "partner_symbolic",
    source:
      "No classical source maps the seventh lord's Pada to a spouse's name; this is a modern symbolic reading (SoulLetter audit C001, C002).",
    sourceUrl: null,
    version: "1.0.0",
    inputRequirements: ["birth_date", "time_zone", "birth_time", "coordinates"],
    calculationProcedure:
      "Whole-sign houses from the sidereal Ascendant → seventh sign → its traditional lord → that planet's sidereal Nakshatra Pada → the Avakahada table cell.",
    outputType: "syllable_candidate",
    candidateMapping: { table: "avakahada", tableVersion: AVAKAHADA_TABLE_VERSION, point: "seventh_house_lord" },
    verificationStatus: "experimental_symbolic",
    limitations: [
      "Experimental symbolic interpretation: it is not an established classical rule and has never been shown to predict a partner's name.",
      "Needs an accurate birth time and birthplace; the Ascendant changes sign about every two hours.",
      AVAKAHADA_LIMITATION,
    ],
    enabled: true,
    displayOrder: 1,
    shareInterpretation:
      "A symbolic sound drawn from the seventh-house lord's lunar mansion — offered for reflection, not as a prediction.",
    auditRefs: ["C001", "C002", "C003", "C004"],
  },
  {
    id: "partner.darakaraka-pada-avakahada",
    name: "Darakaraka's Nakshatra Pada (experimental)",
    tradition: "Modern symbolic adaptation combining Jaimini Chara Karakas with the Avakahada table",
    category: "partner_symbolic",
    source:
      "Darakaraka = lowest degree within sign (Jaimini, 'antye dārakārakaḥ'). Mapping it to a spouse's name syllable is a modern symbolic reading (SoulLetter audit C001, C002, C011).",
    sourceUrl: null,
    version: "1.0.0",
    inputRequirements: ["birth_date", "time_zone", "birth_time"],
    calculationProcedure:
      "Rank the configured Chara Karaka participants (seven planets, or eight with Rahu at 30° − degree) by degree within sign; the lowest is the Darakaraka → its sidereal Nakshatra Pada → the Avakahada table cell.",
    outputType: "syllable_candidate",
    candidateMapping: { table: "avakahada", tableVersion: AVAKAHADA_TABLE_VERSION, point: "darakaraka" },
    verificationStatus: "experimental_symbolic",
    limitations: [
      "Experimental symbolic interpretation: it is not an established classical rule and has never been shown to predict a partner's name.",
      "Seven- and eight-planet Chara Karaka schemes are competing traditions and can give different results.",
      "Near-equal degrees make the Darakaraka undeterminable; the Moon's fast motion makes it birth-time sensitive.",
      AVAKAHADA_LIMITATION,
    ],
    enabled: true,
    displayOrder: 2,
    shareInterpretation:
      "A symbolic sound drawn from the Darakaraka's lunar mansion — offered for reflection, not as a prediction.",
    auditRefs: ["C001", "C002", "C011"],
  },
  {
    id: "numerology.life-path",
    name: "Life Path Number",
    tradition: "Modern Western (Pythagorean) numerology",
    category: "numerology",
    source: "L. Dow Balliett, The Philosophy of Numbers (1908); Hans Decoz, World Numerology",
    sourceUrl: "https://www.worldnumerology.com/numerology-life-path/",
    version: "1.0.0",
    inputRequirements: ["birth_date"],
    calculationProcedure:
      "Configured method: reduce month, day and year separately then reduce their sum, or reduce the sum of all digits; master numbers kept per the configured policy.",
    outputType: "number",
    candidateMapping: null,
    verificationStatus: "documented_traditional_interpretation",
    limitations: ["Symbolic context only; it never creates or reorders syllable candidates.", "Methods differ on master numbers."],
    enabled: true,
    displayOrder: null,
    shareInterpretation: null,
    auditRefs: ["C014"],
  },
  {
    id: "numerology.psychic-number",
    name: "Psychic Number (Mulank)",
    tradition: "Indian numerology (Cheiro's 'birth number')",
    category: "numerology",
    source: "Cheiro's Book of Numbers; Prokerala Mulank calculator",
    sourceUrl: "https://www.prokerala.com/numerology/mulank-calculator.php",
    version: "1.0.0",
    inputRequirements: ["birth_date"],
    calculationProcedure: "Reduce the day of the month to a single digit 1–9.",
    outputType: "number",
    candidateMapping: null,
    verificationStatus: "documented_traditional_interpretation",
    limitations: ["Symbolic context only; it never creates or reorders syllable candidates."],
    enabled: true,
    displayOrder: null,
    shareInterpretation: null,
    auditRefs: ["C014"],
  },
  {
    id: "numerology.destiny-number",
    name: "Destiny Number (Bhagyank)",
    tradition: "Indian numerology",
    category: "numerology",
    source: "AstroSage numerology (single-digit convention)",
    sourceUrl: "https://www.astrosage.com/numerology/life-path-number.asp",
    version: "1.0.0",
    inputRequirements: ["birth_date"],
    calculationProcedure: "Sum every digit of DD MM YYYY and reduce to a single digit 1–9.",
    outputType: "number",
    candidateMapping: null,
    verificationStatus: "documented_traditional_interpretation",
    limitations: [
      "Symbolic context only; it never creates or reorders syllable candidates.",
      "Some calculators keep 11/22/33; this convention reduces to 1–9.",
    ],
    enabled: true,
    displayOrder: null,
    shareInterpretation: null,
    auditRefs: ["C014"],
  },
  {
    id: "numerology.name-pythagorean",
    name: "Name numbers (Pythagorean: Expression, Soul Urge, Personality)",
    tradition: "Modern Western (Pythagorean) numerology",
    category: "numerology",
    source: "Balliett (1908) p.17 letter grid; Decoz name-number method",
    sourceUrl: "https://archive.org/details/philosophyofnumb00ball",
    version: "1.0.0",
    inputRequirements: ["name"],
    calculationProcedure:
      "A=1…I=9, J=1…R=9, S=1…Z=8; sum each name, reduce per name, add the names, reduce. Vowels A E I O U; Y treated as a consonant.",
    outputType: "number",
    candidateMapping: null,
    verificationStatus: "documented_traditional_interpretation",
    limitations: [
      "Symbolic context only; it never creates or reorders syllable candidates.",
      "Only the 26-letter Latin alphabet is supported; names in other scripts are not transliterated.",
    ],
    enabled: true,
    displayOrder: null,
    shareInterpretation: null,
    auditRefs: ["C014"],
  },
  {
    id: "numerology.name-chaldean",
    name: "Name number (Chaldean, Cheiro)",
    tradition: "Chaldean numerology as published by Cheiro",
    category: "numerology",
    source: "Cheiro, Cheiro's Book of Numbers, pp. 70–73",
    sourceUrl: "https://archive.org/details/in.ernet.dli.2015.70770",
    version: "1.0.0",
    inputRequirements: ["name"],
    calculationProcedure:
      "Cheiro's 1–8 letter table; each name's compound total reduced to a single number; the singles are added (compound) and reduced.",
    outputType: "number",
    candidateMapping: null,
    verificationStatus: "documented_traditional_interpretation",
    limitations: [
      "Symbolic context only; it never creates or reorders syllable candidates.",
      "Only the 26-letter Latin alphabet is supported.",
    ],
    enabled: true,
    displayOrder: null,
    shareInterpretation: null,
    auditRefs: ["C014"],
  },
  ...(
    [
      [
        "partner.upapada-lagna",
        "Upapada Lagna spouse indications",
        "Jaimini Arudha of the 12th house",
        "Published calculation variants (exceptions when the Arudha falls in the house or the 7th from it; dual lordship of Scorpio and Aquarius) are unresolved, and no syllable mapping is documented.",
        ["C012"],
      ],
      [
        "partner.nadi-name-examples",
        "Nadi-style literal spouse-name rules",
        "Nadi texts as paraphrased in research drafts",
        "No exact, independently traceable primary passage was found for the elaborate spouse-name examples.",
        ["C002"],
      ],
      [
        "partner.rare-syllable-substitution",
        "Replacing rare syllables with 'usable' ones",
        "Research-draft heuristic",
        "No verified rule supports silent substitution; it would change the lookup result. Rare syllables are always shown as published.",
        ["C003"],
      ],
      [
        "partner.name-frequency-filter",
        "Zipf/Bayesian name-frequency filtering",
        "Research-draft statistical heuristic",
        "A name-frequency prior is not evidence that links a chart to a real partner's name; filtering would manufacture plausible-looking results.",
        ["C004", "C019"],
      ],
      [
        "partner.katapayadi-reverse",
        "Katapayadi reverse mapping to initials",
        "Kerala Katapayadi numeral cipher",
        "Katapayadi encodes numbers in Sanskrit syllables; reversing it is many-to-one and has no documented link to a spouse's name.",
        ["C013"],
      ],
      [
        "partner.prasna-query-time",
        "Prasna (query-time) spouse initial",
        "Prasna Marga horary methods",
        "No source-level rule extraction or evidence that a web-submission timestamp is equivalent to a traditional query.",
        ["C015"],
      ],
      [
        "partner.palm-feature-fusion",
        "Palm-feature fusion score",
        "Palmistry combined with astrology/numerology",
        "No validated model or target exists; hand landmarks do not encode a partner's name. Palm images are never collected.",
        ["C005"],
      ],
      [
        "numerology.number-to-initial",
        "Number → partner initial mapping",
        "Commercial numerology blogs",
        "No documented traditional rule (Cheiro, Balliett, Decoz, numerology.com) links a number to a future partner's initial.",
        ["C014"],
      ],
    ] as const
  ).map(
    ([id, name, tradition, reason, refs]): RuleDefinition => ({
      id,
      name,
      tradition,
      category: "excluded",
      source: "SoulLetter audit (soulletter_audit_artifacts/claim_audit.csv)",
      sourceUrl: null,
      version: "1.0.0",
      inputRequirements: [],
      calculationProcedure: "Not implemented.",
      outputType: "none",
      candidateMapping: null,
      verificationStatus: "disabled_insufficient_evidence",
      limitations: [reason],
      enabled: false,
      displayOrder: null,
      shareInterpretation: null,
      auditRefs: refs,
    }),
  ),
];

const SUPPORTED_POINTS: readonly MappingPoint[] = ["moon", "seventh_house_lord", "darakaraka"];

/** Returns human-readable problems; an empty list means the registry is valid. */
export function validateRegistry(rules: readonly RuleDefinition[] = RULES): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const r of rules) {
    if (ids.has(r.id)) problems.push(`Duplicate rule id ${r.id}`);
    ids.add(r.id);
    if (!r.name || !r.tradition || !r.source || !r.version || !r.calculationProcedure) {
      problems.push(`${r.id}: missing descriptive metadata`);
    }
    if (r.limitations.length === 0) problems.push(`${r.id}: limitations must be declared`);

    const emits = r.outputType === "naming_syllable" || r.outputType === "syllable_candidate";
    if (emits) {
      const m = r.candidateMapping;
      if (!m) problems.push(`${r.id}: emits syllables without a candidate mapping`);
      else {
        if (m.table !== "avakahada") problems.push(`${r.id}: unsupported mapping table ${String(m.table)}`);
        if (!SUPPORTED_POINTS.includes(m.point)) problems.push(`${r.id}: unsupported mapping point ${String(m.point)}`);
        if (m.tableVersion !== AVAKAHADA_TABLE_VERSION) problems.push(`${r.id}: mapping table version mismatch`);
      }
      if (r.verificationStatus === "verified_calculation") {
        problems.push(`${r.id}: an interpretation cannot be labelled a verified calculation`);
      }
    } else if (r.candidateMapping !== null) {
      problems.push(`${r.id}: ${r.outputType} rules must not have a candidate mapping`);
    }
    if (r.category === "partner_symbolic" && r.verificationStatus !== "experimental_symbolic") {
      problems.push(`${r.id}: partner rules must be labelled experimental_symbolic`);
    }
    if (r.category === "partner_symbolic" && (r.displayOrder === null || r.displayOrder < 1)) {
      problems.push(`${r.id}: partner rules need a display order`);
    }
    if (r.category === "excluded" && (r.enabled || r.verificationStatus !== "disabled_insufficient_evidence")) {
      problems.push(`${r.id}: excluded rules must be disabled`);
    }
  }
  for (const id of ENABLEABLE_RULE_IDS) {
    const r = rules.find((x) => x.id === id);
    if (!r) problems.push(`Enableable rule ${id} is not registered`);
    else if (!r.enabled) problems.push(`Enableable rule ${id} is disabled in the registry`);
  }
  for (const id of EXCLUDED_RULE_IDS) {
    if (!rules.some((x) => x.id === id)) problems.push(`Excluded rule ${id} is not registered`);
  }
  return problems;
}

export function getRule(id: string): RuleDefinition | undefined {
  return RULES.find((r) => r.id === id);
}

export class RuleNotEligibleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleNotEligibleError";
  }
}

/**
 * Guard used by the candidate engine before any rule emits a syllable. Throws for
 * disabled rules, rules without a supported mapping, or non-candidate rules.
 */
export function assertCanEmitSyllable(rule: RuleDefinition, expectedPoint: MappingPoint): void {
  if (!rule.enabled) throw new RuleNotEligibleError(`${rule.id} is disabled`);
  if (rule.outputType !== "naming_syllable" && rule.outputType !== "syllable_candidate") {
    throw new RuleNotEligibleError(`${rule.id} does not produce syllables`);
  }
  const m = rule.candidateMapping;
  if (!m || m.table !== "avakahada" || m.tableVersion !== AVAKAHADA_TABLE_VERSION || m.point !== expectedPoint) {
    throw new RuleNotEligibleError(`${rule.id} has an unsupported candidate mapping`);
  }
  if (rule.verificationStatus === "disabled_insufficient_evidence") {
    throw new RuleNotEligibleError(`${rule.id} is disabled for insufficient evidence`);
  }
}

/** Calculation components shown on the methodology page (not interpretation rules). */
export interface CalculationComponent {
  id: string;
  name: string;
  verificationStatus: VerificationStatus;
  procedure: string;
  verification: string;
}

export const CALCULATION_COMPONENTS: readonly CalculationComponent[] = [
  {
    id: "calc.time-conversion",
    name: "Local time → UTC → Julian Day",
    verificationStatus: "verified_calculation",
    procedure:
      "Historical UTC offset from the IANA time-zone database (runtime ICU tzdata); DST gaps rejected, overlaps require an explicit choice; Julian Day from the ephemeris engine.",
    verification: "Unit tests against Meeus' worked examples, J2000.0 and historical offsets (Asia/Kolkata 1890, 1943, 1990; US DST).",
  },
  {
    id: "calc.sidereal-positions",
    name: "Sidereal (Lahiri) planetary positions — D1/Rashi",
    verificationStatus: "verified_calculation",
    procedure:
      "Apparent geocentric longitudes from astronomy-engine minus the Lahiri ayanamsha (Swiss Ephemeris SE_SIDM_LAHIRI definition).",
    verification:
      "Compared with Swiss Ephemeris 2.10.03 (SWIEPH files) over 12,000 instants and with JPL Horizons; measured tolerances drive boundary-sensitivity flags.",
  },
  {
    id: "calc.ascendant",
    name: "Ascendant and whole-sign houses",
    verificationStatus: "verified_calculation",
    procedure: "Apparent sidereal time + true obliquity; Ascendant formula; whole-sign houses from the Ascendant's sign.",
    verification: "Compared with Swiss Ephemeris swe_houses (sidereal, whole sign).",
  },
  {
    id: "calc.nakshatra-pada",
    name: "Nakshatra, Pada and Navamsa (D9)",
    verificationStatus: "verified_calculation",
    procedure: "27 × 13°20′ Nakshatras, 108 × 3°20′ Padas, half-open boundaries; Navamsa = Pada index mod 12.",
    verification: "Boundary tests at all 27 Nakshatra and 108 Pada boundaries; reference Moon Pada matches published panchang timings.",
  },
  {
    id: "calc.chara-karakas",
    name: "Chara Karakas (Darakaraka)",
    verificationStatus: "documented_traditional_interpretation",
    procedure: "Explicit seven- or eight-planet convention; ties within engine tolerance are reported, never broken silently.",
    verification: "Unit tests for ordering, Rahu handling and ties; reference case cross-checked with Swiss Ephemeris.",
  },
];
