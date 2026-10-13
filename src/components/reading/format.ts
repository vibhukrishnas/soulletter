/**
 * Display labels for values returned by the calculation service. These functions only
 * format or label service values — they never compute or substitute astrological data.
 */
import type { BadgeTone } from "@/components/ui";
import type {
  CharaKarakaScheme,
  CoverageLevel,
  NodeType,
  TimeBasis,
  TimeContext,
  WarningSeverity,
} from "@/lib/contracts/chart";
import type { NumerologySettings } from "@/lib/contracts/input";
import type { CandidateQualifier, TimeCondition } from "@/lib/contracts/reading";

export const QUALIFIER_INFO: Record<CandidateQualifier, { label: string; description: string; tone: BadgeTone }> = {
  experimental_rule: {
    label: "Experimental rule",
    description: "Produced by an experimental symbolic rule, not an established classical technique.",
    tone: "indigo",
  },
  provisional_mapping: {
    label: "Provisional table",
    description: "The syllable comes from a provisional Avakahada table compiled from modern secondary sources.",
    tone: "neutral",
  },
  boundary_sensitive: {
    label: "Boundary-sensitive",
    description:
      "The point is within the measured engine tolerance of a Pada boundary, so a neighbouring Pada is also possible.",
    tone: "caution",
  },
  time_sensitive: {
    label: "Birth-time sensitive",
    description: "The result changes within your birth-time uncertainty window.",
    tone: "caution",
  },
  time_conditional: {
    label: "Depends on birth time",
    description: "This syllable only applies if the birth time falls in the range shown.",
    tone: "caution",
  },
  tie_sensitive: {
    label: "Tie-sensitive",
    description: "Two Chara Karaka degrees are too close to separate within the engine tolerance.",
    tone: "caution",
  },
};

export const COVERAGE_LABEL: Record<CoverageLevel, string> = {
  full: "Full coverage",
  partial: "Partial coverage",
  limited: "Limited coverage",
};

export const COVERAGE_TONE: Record<CoverageLevel, BadgeTone> = {
  full: "success",
  partial: "caution",
  limited: "important",
};

export const SEVERITY_LABEL: Record<WarningSeverity, string> = {
  important: "Important",
  caution: "Caution",
  info: "Note",
};

export const BASIS_LABEL: Record<TimeBasis, string> = {
  exact_instant: "A stated birth instant",
  local_day: "The whole local birth date (birth time unknown)",
  utc_window: "Every possible UTC offset (time zone unknown)",
};

export const DST_LABEL: Record<TimeContext["dst"], string> = {
  not_applicable: "Not applicable",
  unique: "Unambiguous local time",
  ambiguous_earlier: "Repeated hour — the earlier occurrence (your choice)",
  ambiguous_later: "Repeated hour — the later occurrence (your choice)",
};

export const NODE_LABEL: Record<NodeType, string> = { mean: "Mean node", true: "True node" };

export const KARAKA_SCHEME_LABEL: Record<CharaKarakaScheme, string> = {
  seven_planet: "Seven planets (Rahu excluded)",
  eight_planet: "Eight planets (Rahu at 30° − degree in sign)",
};

export const LIFE_PATH_LABEL: Record<NumerologySettings["lifePathMethod"], string> = {
  reduce_components: "Reduce month, day and year separately",
  full_digit_sum: "Add every digit",
};

export const MASTER_LABEL: Record<NumerologySettings["masterNumbers"], string> = {
  keep_11_22_33: "Keep 11, 22 and 33",
  keep_11_22: "Keep 11 and 22",
  none: "Always reduce to 1–9",
};

/** How the local wall-clock labels in window segments should be read. */
export function localZoneNote(time: TimeContext): string {
  return time.timeZone ? `local time, ${time.timeZone}` : "UTC — the birth time zone is unknown";
}

/** Human description of when an evidence item applies. */
export function conditionLabel(condition: TimeCondition, time: TimeContext): string {
  switch (condition.kind) {
    case "at_stated_time":
      return "At your stated birth time";
    case "whole_window":
      return "Throughout your birth-time window";
    case "time_range":
      return `Only if born between ${condition.fromLocal} and ${condition.toLocal} (${localZoneNote(time)})`;
  }
}

/** Range label for a window segment, e.g. "1990-10-15 00:00 – 01:52". */
export function rangeLabel(fromLocal: string, toLocal: string): string {
  const [fromDate] = fromLocal.split(" ");
  const [toDate, toTime] = toLocal.split(" ");
  return fromDate === toDate && toTime ? `${fromLocal} – ${toTime}` : `${fromLocal} – ${toLocal}`;
}

/** Formats an ISO-8601 instant from the service as "YYYY-MM-DD HH:MM:SS UTC" without reinterpreting it. */
export function utcLabel(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}(?::\d{2})?)/.exec(iso);
  return m ? `${m[1]} ${m[2]} UTC` : iso;
}

/** Formats an expiry instant for people (date and time in UTC, so server and client agree). */
export function expiryLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(d);
}
