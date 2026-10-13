/**
 * Calendar validation and civil-time → UTC conversion.
 *
 * Historical UTC offsets come from the IANA time zone database bundled with the
 * JavaScript runtime's ICU data (Node.js exposes its version as
 * `process.versions.tz`). We never guess an offset: local times that do not
 * exist (DST gaps) or occur twice (DST overlaps) are reported explicitly.
 */

export const MIN_SUPPORTED_YEAR = 1800;
export const MAX_SUPPORTED_YEAR = 2100;
/** tzdb data before 1970 is not guaranteed to be complete for every region. */
export const TZDB_RELIABLE_FROM_YEAR = 1970;

export interface CalendarDate {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
}

export interface ClockTime {
  hour: number; // 0..23
  minute: number; // 0..59
  second: number; // 0..59
}

/** Gregorian leap-year rule. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  const lengths = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return lengths[month - 1];
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Strict `YYYY-MM-DD` parser. Returns null for impossible dates (e.g. 2023-02-29). */
export function parseIsoDate(value: string): CalendarDate | null {
  const m = DATE_RE.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

/** Strict 24-hour `HH:mm` or `HH:mm:ss` parser. */
export function parseClockTime(value: string): ClockTime | null {
  const m = TIME_RE.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] === undefined ? 0 : Number(m[3]);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return { hour, minute, second };
}

export function isSupportedYear(year: number): boolean {
  return year >= MIN_SUPPORTED_YEAR && year <= MAX_SUPPORTED_YEAR;
}

/** IANA identifiers only (Area/Location, UTC, Etc/…); raw offsets like "+05:30" are rejected. */
const IANA_ID_RE = /^(?:[A-Za-z][A-Za-z0-9_+-]*)(?:\/[A-Za-z0-9][A-Za-z0-9_+-]*)*$/;

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function wallClockFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidIanaTimeZone(timeZone: unknown): timeZone is string {
  if (typeof timeZone !== "string") return false;
  const tz = timeZone.trim();
  if (tz.length === 0 || tz.length > 64 || !IANA_ID_RE.test(tz)) return false;
  if (!tz.includes("/") && tz !== "UTC" && tz !== "GMT") return false;
  try {
    wallClockFormatter(tz);
    return true;
  } catch {
    return false;
  }
}

/** The runtime's resolved (ICU-canonical) id, e.g. "Asia/Kolkata" → "Asia/Calcutta". */
export function runtimeCanonicalTimeZone(timeZone: string): string {
  return wallClockFormatter(timeZone).resolvedOptions().timeZone;
}

/** UTC offset in seconds (local − UTC) in effect at a UTC instant. */
export function offsetSecondsAt(utcMillis: number, timeZone: string): number {
  const t = Math.floor(utcMillis / 1000) * 1000;
  const parts = wallClockFormatter(timeZone).formatToParts(new Date(t));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return Math.round((asUtc - t) / 1000);
}

export interface ResolvedInstant {
  utcMillis: number;
  offsetSeconds: number;
}

export type LocalTimeResolution =
  | { kind: "unique"; instant: ResolvedInstant }
  /** DST overlap: the wall-clock time happened twice. Ordered earlier first. */
  | { kind: "ambiguous"; earlier: ResolvedInstant; later: ResolvedInstant }
  /** DST gap: the wall-clock time never happened in this zone. */
  | { kind: "nonexistent"; offsetBeforeSeconds: number; offsetAfterSeconds: number };

/** Wall-clock components interpreted as if they were UTC (a "local timestamp"). */
export function wallClockMillis(date: CalendarDate, time: ClockTime): number {
  const ms = Date.UTC(date.year, date.month - 1, date.day, time.hour, time.minute, time.second);
  return ms;
}

/**
 * Resolves a civil date-time in an IANA zone to UTC, detecting DST gaps and overlaps.
 * Candidate offsets are sampled every 6 h over ±30 h, which covers every
 * transition pattern present in tzdb (including whole-day skips).
 */
export function resolveLocalDateTime(
  date: CalendarDate,
  time: ClockTime,
  timeZone: string,
): LocalTimeResolution {
  const local = wallClockMillis(date, time);
  const offsets = new Set<number>();
  for (let h = -30; h <= 30; h += 6) {
    offsets.add(offsetSecondsAt(local + h * 3_600_000, timeZone));
  }
  const solutions: ResolvedInstant[] = [];
  for (const offset of offsets) {
    const utc = local - offset * 1000;
    if (offsetSecondsAt(utc, timeZone) === offset) {
      if (!solutions.some((s) => s.utcMillis === utc)) {
        solutions.push({ utcMillis: utc, offsetSeconds: offset });
      }
    }
  }
  solutions.sort((a, b) => a.utcMillis - b.utcMillis);
  if (solutions.length === 1) return { kind: "unique", instant: solutions[0] };
  if (solutions.length >= 2) {
    return { kind: "ambiguous", earlier: solutions[0], later: solutions[solutions.length - 1] };
  }
  return {
    kind: "nonexistent",
    offsetBeforeSeconds: offsetSecondsAt(local - 12 * 3_600_000, timeZone),
    offsetAfterSeconds: offsetSecondsAt(local + 12 * 3_600_000, timeZone),
  };
}

/** "+05:30", "-04:00", or "+05:21:10" when the offset has a seconds component (LMT). */
export function formatOffset(offsetSeconds: number): string {
  const sign = offsetSeconds < 0 ? "-" : "+";
  const abs = Math.abs(offsetSeconds);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  const base = `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return s === 0 ? base : `${base}:${String(s).padStart(2, "0")}`;
}

/** Offsets that are not whole quarter-hours usually indicate Local Mean Time in tzdb. */
export function looksLikeLocalMeanTime(offsetSeconds: number): boolean {
  return offsetSeconds % 900 !== 0;
}

/** Julian Day (UT) from a Unix epoch timestamp. Independent of any ephemeris library. */
export function julianDayFromUnixMillis(utcMillis: number): number {
  return utcMillis / 86_400_000 + 2_440_587.5;
}

/**
 * Julian Day for a Gregorian calendar date (Meeus, Astronomical Algorithms, ch. 7).
 * `dayFraction` is the day of month including the fraction of the day (UT).
 * Used as an independent cross-check of the engine's Julian Day.
 */
export function meeusJulianDay(year: number, month: number, dayFraction: number): number {
  let y = year;
  let m = month;
  if (m <= 2) {
    y -= 1;
    m += 12;
  }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + dayFraction + b - 1524.5;
}

/** ISO-8601 UTC string with second precision. */
export function isoUtc(utcMillis: number): string {
  return new Date(utcMillis).toISOString().replace(/\.\d{3}Z$/, "Z");
}

/** Formats a UTC instant as local wall-clock "YYYY-MM-DD HH:mm" in the given zone. */
export function formatLocal(utcMillis: number, timeZone: string, withSeconds = false): string {
  const parts = wallClockFormatter(timeZone).formatToParts(new Date(utcMillis));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const base = `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
  return withSeconds ? `${base}:${get("second")}` : base;
}

/** Version of the IANA tz database used by the runtime, when exposed. */
export function tzdbVersion(): string | null {
  const v = (globalThis as { process?: { versions?: Record<string, string> } }).process?.versions;
  return v?.tz ?? null;
}
