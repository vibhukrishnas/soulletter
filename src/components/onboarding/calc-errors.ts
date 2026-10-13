/** Pure helpers for presenting calculation errors (no React). */

export interface AmbiguousTimeOption {
  choice: "earlier" | "later";
  utc: string;
  offset: string;
}

function isOccurrence(v: unknown): v is { utc: string; offset: string } {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.utc === "string" && typeof o.offset === "string";
}

/** Reads the two occurrences from an AMBIGUOUS_LOCAL_TIME error's details, or null. */
export function ambiguousOptions(details: Record<string, unknown> | undefined): AmbiguousTimeOption[] | null {
  if (!details) return null;
  const { earlier, later } = details;
  if (!isOccurrence(earlier) || !isOccurrence(later)) return null;
  return [
    { choice: "earlier", utc: earlier.utc, offset: earlier.offset },
    { choice: "later", utc: later.utc, offset: later.offset },
  ];
}

/** Reads the offsets around a daylight-saving gap from NONEXISTENT_LOCAL_TIME details. */
export function gapOffsets(details: Record<string, unknown> | undefined): { before: string; after: string } | null {
  if (!details) return null;
  const { offsetBefore, offsetAfter } = details;
  if (typeof offsetBefore !== "string" || typeof offsetAfter !== "string") return null;
  return { before: offsetBefore, after: offsetAfter };
}

const PATH_LABELS: readonly [string, string][] = [
  ["birth.birthDate", "Date of birth"],
  ["birth.birthTimeKnown", "Birth time known"],
  ["birth.birthTimeAccuracy", "Birth-time accuracy"],
  ["birth.birthTime", "Birth time"],
  ["birth.dstChoice", "Repeated hour"],
  ["birth.place.label", "Place name"],
  ["birth.place.latitude", "Latitude"],
  ["birth.place.longitude", "Longitude"],
  ["birth.place.timeZone", "Time zone"],
  ["birth.place", "Birthplace"],
  ["settings", "Calculation settings"],
  ["numerology", "Numerology settings"],
  ["enabledRuleIds", "Methods"],
  ["acknowledgeExperimental", "Experimental-rule acknowledgement"],
  ["name", "Name"],
  ["_form", "Request"],
];

/** Human label for a dotted field path such as "birth.place.timeZone". */
export function fieldPathLabel(path: string): string {
  for (const [prefix, label] of PATH_LABELS) {
    if (path === prefix || path.startsWith(`${prefix}.`)) return label;
  }
  return path;
}

/** "+05:30" → "UTC+05:30". */
export function utcOffsetLabel(offset: string): string {
  return offset.startsWith("UTC") ? offset : `UTC${offset}`;
}
