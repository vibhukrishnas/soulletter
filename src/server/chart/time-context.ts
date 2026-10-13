import {
  formatLocal,
  formatOffset,
  isoUtc,
  parseClockTime,
  parseIsoDate,
  resolveLocalDateTime,
  runtimeCanonicalTimeZone,
  wallClockMillis,
  type CalendarDate,
  type ClockTime,
  type ResolvedInstant,
} from "@/lib/astro/time";
import type { BirthTimeAccuracy, TimeBasis } from "@/lib/contracts/chart";
import type { BirthInput } from "@/lib/contracts/input";

/** Half-width of the uncertainty window for each declared birth-time accuracy. */
export const ACCURACY_HALF_WINDOW_MS: Record<BirthTimeAccuracy, number> = {
  to_the_minute: 60_000,
  within_15_minutes: 15 * 60_000,
  within_1_hour: 60 * 60_000,
};

/** Civil UTC offsets in tzdb range from −12:00 to +14:00. */
const MAX_WEST_OFFSET_MS = 12 * 3_600_000;
const MAX_EAST_OFFSET_MS = 14 * 3_600_000;

export interface NormalizedBirth {
  date: CalendarDate;
  dateIso: string;
  time: ClockTime | null;
  timeIso: string | null;
  accuracy: BirthTimeAccuracy | null;
  timeZone: string | null;
  latitude: number | null;
  longitude: number | null;
  placeLabel: string | null;
  dstChoice: "earlier" | "later" | null;
}

/** Converts a schema-validated BirthInput into typed parts. Throws only on programmer error. */
export function normalizeBirth(input: BirthInput): NormalizedBirth {
  const date = parseIsoDate(input.birthDate);
  if (!date) throw new Error("normalizeBirth called with an unvalidated date");
  const time = input.birthTimeKnown && input.birthTime ? parseClockTime(input.birthTime) : null;
  if (input.birthTimeKnown && !time) throw new Error("normalizeBirth called with an unvalidated time");
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date,
    dateIso: input.birthDate,
    time,
    timeIso: time ? `${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}` : null,
    accuracy: input.birthTimeKnown ? input.birthTimeAccuracy : null,
    timeZone: input.place.timeZone?.trim() || null,
    latitude: input.place.latitude,
    longitude: input.place.longitude,
    placeLabel: input.place.label?.trim() || null,
    dstChoice: input.dstChoice,
  };
}

export interface InternalTimeContext {
  basis: TimeBasis;
  nominalUtc: number | null;
  windowStart: number;
  windowEnd: number;
  offsetSeconds: number | null;
  dst: "not_applicable" | "unique" | "ambiguous_earlier" | "ambiguous_later";
  windowReason: string;
  runtimeTimeZone: string | null;
}

export type TimeContextResult =
  | { ok: true; ctx: InternalTimeContext }
  | {
      ok: false;
      code: "AMBIGUOUS_LOCAL_TIME";
      message: string;
      details: { earlier: { utc: string; offset: string }; later: { utc: string; offset: string } };
    }
  | {
      ok: false;
      code: "NONEXISTENT_LOCAL_TIME";
      message: string;
      details: { offsetBefore: string; offsetAfter: string };
    };

function nextDate(d: CalendarDate): CalendarDate {
  const ms = Date.UTC(d.year, d.month - 1, d.day + 1);
  const n = new Date(ms);
  return { year: n.getUTCFullYear(), month: n.getUTCMonth() + 1, day: n.getUTCDate() };
}

/** First UTC instant whose local date in `timeZone` is `date`. */
function startOfLocalDay(date: CalendarDate, timeZone: string): number {
  for (let minute = 0; minute <= 180; minute++) {
    const r = resolveLocalDateTime(
      date,
      { hour: Math.floor(minute / 60), minute: minute % 60, second: 0 },
      timeZone,
    );
    if (r.kind === "unique") return r.instant.utcMillis;
    if (r.kind === "ambiguous") return r.earlier.utcMillis;
  }
  throw new Error("Could not resolve the start of the local day");
}

export function buildTimeContext(birth: NormalizedBirth): TimeContextResult {
  const { date, time, timeZone } = birth;

  if (timeZone === null) {
    const runtimeTimeZone = null;
    if (time) {
      const wall = wallClockMillis(date, time);
      return {
        ok: true,
        ctx: {
          basis: "utc_window",
          nominalUtc: null,
          windowStart: wall - MAX_EAST_OFFSET_MS,
          windowEnd: wall + MAX_WEST_OFFSET_MS,
          offsetSeconds: null,
          dst: "not_applicable",
          windowReason:
            "No time zone was given, so the local birth time could correspond to any UTC offset from −12:00 to +14:00.",
          runtimeTimeZone,
        },
      };
    }
    const dayStart = wallClockMillis(date, { hour: 0, minute: 0, second: 0 });
    return {
      ok: true,
      ctx: {
        basis: "utc_window",
        nominalUtc: null,
        windowStart: dayStart - MAX_EAST_OFFSET_MS,
        windowEnd: dayStart + 86_400_000 + MAX_WEST_OFFSET_MS,
        offsetSeconds: null,
        dst: "not_applicable",
        windowReason:
          "No birth time or time zone was given, so every moment of the birth date in every UTC offset is considered.",
        runtimeTimeZone,
      },
    };
  }

  const runtimeTimeZone = runtimeCanonicalTimeZone(timeZone);

  if (!time) {
    const start = startOfLocalDay(date, timeZone);
    const end = startOfLocalDay(nextDate(date), timeZone);
    return {
      ok: true,
      ctx: {
        basis: "local_day",
        nominalUtc: null,
        windowStart: start,
        windowEnd: end,
        offsetSeconds: null,
        dst: "not_applicable",
        windowReason: "No birth time was given, so the whole local birth date is considered.",
        runtimeTimeZone,
      },
    };
  }

  const r = resolveLocalDateTime(date, time, timeZone);
  let instant: ResolvedInstant;
  let dst: InternalTimeContext["dst"] = "unique";
  if (r.kind === "nonexistent") {
    return {
      ok: false,
      code: "NONEXISTENT_LOCAL_TIME",
      message:
        "This local time did not exist in the selected time zone on that date (clocks were moved forward). Please check the birth time or time zone.",
      details: {
        offsetBefore: formatOffset(r.offsetBeforeSeconds),
        offsetAfter: formatOffset(r.offsetAfterSeconds),
      },
    };
  }
  if (r.kind === "ambiguous") {
    if (birth.dstChoice === null) {
      return {
        ok: false,
        code: "AMBIGUOUS_LOCAL_TIME",
        message:
          "This local time occurred twice in the selected time zone (clocks were moved back). Choose whether the birth was the earlier or later occurrence.",
        details: {
          earlier: { utc: isoUtc(r.earlier.utcMillis), offset: formatOffset(r.earlier.offsetSeconds) },
          later: { utc: isoUtc(r.later.utcMillis), offset: formatOffset(r.later.offsetSeconds) },
        },
      };
    }
    instant = birth.dstChoice === "earlier" ? r.earlier : r.later;
    dst = birth.dstChoice === "earlier" ? "ambiguous_earlier" : "ambiguous_later";
  } else {
    instant = r.instant;
  }

  const half = ACCURACY_HALF_WINDOW_MS[birth.accuracy ?? "to_the_minute"];
  return {
    ok: true,
    ctx: {
      basis: "exact_instant",
      nominalUtc: instant.utcMillis,
      windowStart: instant.utcMillis - half,
      windowEnd: instant.utcMillis + half,
      offsetSeconds: instant.offsetSeconds,
      dst,
      windowReason:
        birth.accuracy === "within_1_hour"
          ? "The birth time was marked accurate to within about an hour, so ±60 minutes are considered."
          : birth.accuracy === "within_15_minutes"
            ? "The birth time was marked accurate to within about 15 minutes, so ±15 minutes are considered."
            : "The birth time was given to the minute, so ±1 minute (recording precision) is considered.",
      runtimeTimeZone,
    },
  };
}

/** Local wall-clock label for a UTC instant (UTC label when no zone is known). */
export function localLabel(utcMillis: number, timeZone: string | null): string {
  if (!timeZone) return `${isoUtc(utcMillis).replace("T", " ").slice(0, 16)} UTC`;
  return formatLocal(utcMillis, timeZone);
}
