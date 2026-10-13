/**
 * Onboarding form model (client). Pure functions: form values ⇄ API request, plus
 * best-effort sessionStorage persistence on the user's own device.
 *
 * Nothing is guessed: unanswered questions stay unanswered and block "Continue" with a
 * message; defaults that ARE applied (calculation conventions) are shown on the review step.
 */
import type { BirthTimeAccuracy, CharaKarakaScheme, NodeType } from "@/lib/contracts/chart";
import {
  readingRequestSchema,
  type NumerologySettings,
  type ReadingRequest,
} from "@/lib/contracts/input";
import { isValidIanaTimeZone, parseClockTime, parseIsoDate } from "@/lib/astro/time";
import type { EnableableRuleId } from "@/lib/rules/ids";

export type PlaceMode = "search" | "manual" | "time_zone_only" | "skip";

export interface MethodToggles {
  nativeNaming: boolean;
  partnerSeventhLord: boolean;
  partnerDarakaraka: boolean;
  lifePath: boolean;
  psychicNumber: boolean;
  destinyNumber: boolean;
  namePythagorean: boolean;
  nameChaldean: boolean;
}

export interface OnboardingValues {
  name: string;
  birthDate: string;
  /** null until the user answers "Do you know your birth time?" */
  birthTimeKnown: boolean | null;
  birthTime: string;
  birthTimeAccuracy: BirthTimeAccuracy;
  dstChoice: "earlier" | "later" | null;
  placeMode: PlaceMode | null;
  placeLabel: string;
  latitude: string;
  longitude: string;
  timeZone: string;
  nodeType: NodeType;
  charaKarakaScheme: CharaKarakaScheme;
  lifePathMethod: NumerologySettings["lifePathMethod"];
  masterNumbers: NumerologySettings["masterNumbers"];
  methods: MethodToggles;
  acknowledgeExperimental: boolean;
}

export const INITIAL_VALUES: OnboardingValues = {
  name: "",
  birthDate: "",
  birthTimeKnown: null,
  birthTime: "",
  birthTimeAccuracy: "to_the_minute",
  dstChoice: null,
  placeMode: null,
  placeLabel: "",
  latitude: "",
  longitude: "",
  timeZone: "",
  nodeType: "mean",
  charaKarakaScheme: "seven_planet",
  lifePathMethod: "reduce_components",
  masterNumbers: "keep_11_22_33",
  methods: {
    nativeNaming: true,
    partnerSeventhLord: true,
    partnerDarakaraka: true,
    lifePath: true,
    psychicNumber: true,
    destinyNumber: true,
    namePythagorean: false,
    nameChaldean: false,
  },
  acknowledgeExperimental: false,
};

export type StepId = "profile" | "birth" | "preferences" | "review";
export const STEPS: readonly { id: StepId; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "birth", label: "Birth details" },
  { id: "preferences", label: "Calculation" },
  { id: "review", label: "Review" },
];

export type FieldErrors = Partial<Record<string, string>>;

const RULE_FOR: Record<keyof MethodToggles, EnableableRuleId> = {
  nativeNaming: "naming.moon-pada-avakahada",
  partnerSeventhLord: "partner.seventh-lord-pada-avakahada",
  partnerDarakaraka: "partner.darakaraka-pada-avakahada",
  lifePath: "numerology.life-path",
  psychicNumber: "numerology.psychic-number",
  destinyNumber: "numerology.destiny-number",
  namePythagorean: "numerology.name-pythagorean",
  nameChaldean: "numerology.name-chaldean",
};

export function enabledRuleIds(methods: MethodToggles): EnableableRuleId[] {
  return (Object.keys(RULE_FOR) as (keyof MethodToggles)[]).filter((k) => methods[k]).map((k) => RULE_FOR[k]);
}

export function partnerRulesEnabled(methods: MethodToggles): boolean {
  return methods.partnerSeventhLord || methods.partnerDarakaraka;
}

export function nameMethodsEnabled(methods: MethodToggles): boolean {
  return methods.namePythagorean || methods.nameChaldean;
}

function parseCoordinate(value: string): number | null {
  const t = value.trim();
  if (t === "") return null;
  if (!/^[-+]?\d{1,3}(\.\d+)?$/.test(t)) return Number.NaN;
  return Number(t);
}

/** Today's date in the browser's zone as YYYY-MM-DD (for the date picker maximum). */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Validates one step; returns messages keyed by form field name. */
export function validateStep(step: StepId, v: OnboardingValues): FieldErrors {
  const e: FieldErrors = {};
  if (step === "profile") {
    const date = parseIsoDate(v.birthDate);
    if (!v.birthDate) e.birthDate = "Enter your date of birth.";
    else if (!date) e.birthDate = "Enter a real calendar date.";
    else if (date.year < 1800) e.birthDate = "Dates before 1800 are not supported.";
    else if (v.birthDate > todayIso()) e.birthDate = "The date of birth cannot be in the future.";
    if (v.name.length > 80) e.name = "Use 80 characters or fewer.";
  }
  if (step === "birth") {
    if (v.birthTimeKnown === null) e.birthTimeKnown = "Tell us whether you know your birth time.";
    if (v.birthTimeKnown === true && !parseClockTime(v.birthTime)) e.birthTime = "Enter the birth time as hh:mm and choose AM or PM.";
    if (v.placeMode === null) e.placeMode = "Choose how to give your birthplace, or skip it.";
    if (v.placeMode === "search" || v.placeMode === "manual") {
      const lat = parseCoordinate(v.latitude);
      const lon = parseCoordinate(v.longitude);
      if (lat === null || Number.isNaN(lat) || lat < -90 || lat > 90) e.latitude = "Latitude must be a number between −90 and 90.";
      if (lon === null || Number.isNaN(lon) || lon < -180 || lon > 180) e.longitude = "Longitude must be a number between −180 and 180.";
      if (v.placeMode === "search" && !v.placeLabel) e.placeLabel = "Search for your birthplace and pick a result.";
    }
    if (v.placeMode === "search" || v.placeMode === "manual" || v.placeMode === "time_zone_only") {
      if (!isValidIanaTimeZone(v.timeZone)) e.timeZone = "Choose a time zone such as Asia/Kolkata.";
    }
  }
  if (step === "preferences") {
    if (enabledRuleIds(v.methods).length === 0) e.methods = "Select at least one method.";
    if (partnerRulesEnabled(v.methods) && !v.acknowledgeExperimental) {
      e.acknowledgeExperimental = "Please confirm you understand the partner readings are experimental and symbolic.";
    }
    if (nameMethodsEnabled(v.methods) && !v.name.trim()) {
      e.name = "Name-based numerology needs a name — add one in step 1 or switch these methods off.";
    }
  }
  return e;
}

/** Converts form values to the API request (only sending the name when a name method is on). */
export function toReadingRequest(v: OnboardingValues): ReadingRequest {
  const withPlace = v.placeMode === "search" || v.placeMode === "manual";
  const withZone = withPlace || v.placeMode === "time_zone_only";
  return {
    birth: {
      birthDate: v.birthDate,
      birthTimeKnown: v.birthTimeKnown === true,
      birthTime: v.birthTimeKnown === true ? v.birthTime : null,
      birthTimeAccuracy: v.birthTimeKnown === true ? v.birthTimeAccuracy : null,
      dstChoice: v.dstChoice,
      place: {
        label: withPlace && v.placeLabel.trim() ? v.placeLabel.trim().slice(0, 160) : null,
        latitude: withPlace ? Number(v.latitude) : null,
        longitude: withPlace ? Number(v.longitude) : null,
        timeZone: withZone ? v.timeZone.trim() : null,
      },
    },
    settings: {
      zodiac: "sidereal",
      ayanamsha: "lahiri",
      chart: "D1",
      houseSystem: "whole_sign",
      nodeType: v.nodeType,
      charaKarakaScheme: v.charaKarakaScheme,
    },
    numerology: { lifePathMethod: v.lifePathMethod, masterNumbers: v.masterNumbers, yHandling: "consonant" },
    enabledRuleIds: enabledRuleIds(v.methods),
    acknowledgeExperimental: partnerRulesEnabled(v.methods) ? v.acknowledgeExperimental : false,
    name: nameMethodsEnabled(v.methods) && v.name.trim() ? v.name.trim() : null,
  };
}

/** Full client-side check with the same schema the server uses. */
export function validateRequest(request: ReadingRequest): FieldErrors {
  const r = readingRequestSchema.safeParse(request);
  if (r.success) return {};
  const e: FieldErrors = {};
  for (const issue of r.error.issues) {
    const path = issue.path.join(".");
    const field =
      path === "birth.birthDate" ? "birthDate"
      : path === "birth.birthTime" ? "birthTime"
      : path.startsWith("birth.place.latitude") ? "latitude"
      : path.startsWith("birth.place.longitude") ? "longitude"
      : path.startsWith("birth.place.timeZone") ? "timeZone"
      : path === "name" ? "name"
      : path === "acknowledgeExperimental" ? "acknowledgeExperimental"
      : "_form";
    e[field] ??= issue.message;
  }
  return e;
}

// ------------------------------------------------------------------ persistence
const STORAGE_KEY = "soulletter.onboarding.v1";

/** Saves progress to sessionStorage (cleared when the tab closes). Never throws. */
export function saveProgress(values: OnboardingValues, step: StepId): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ values, step }));
  } catch {
    // Storage may be unavailable (private mode, blocked); the form still works in memory.
  }
}

export function loadProgress(): { values: OnboardingValues; step: StepId } | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { values?: Partial<OnboardingValues>; step?: StepId };
    if (!parsed.values) return null;
    const values = { ...INITIAL_VALUES, ...parsed.values, methods: { ...INITIAL_VALUES.methods, ...parsed.values.methods } };
    const step = STEPS.some((s) => s.id === parsed.step) ? (parsed.step as StepId) : "profile";
    return { values, step };
  } catch {
    return null;
  }
}

export function clearProgress(): void {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
