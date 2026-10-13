/**
 * Best-effort sessionStorage persistence for the last reading on the user's own device.
 *
 * The stored value is exactly what the service returned — it is never edited, merged or
 * "repaired". Anything that does not look like a completed reading of the current schema
 * is discarded rather than shown. Storage is cleared with the tab, or explicitly by
 * {@link clearStoredDetails} ("Clear my details").
 */
import { READING_SCHEMA_VERSION, type ReadingResult } from "@/lib/contracts/reading";
import { clearProgress } from "./onboarding";

const READING_KEY = "soulletter.reading.v1";

export interface StoredReading {
  result: ReadingResult;
  /** True once the user has seen the reveal, so a refresh goes straight to the results. */
  revealed: boolean;
}

function looksLikeReading(value: unknown): value is ReadingResult {
  if (!value || typeof value !== "object") return false;
  const r = value as Partial<ReadingResult>;
  return (
    r.status === "completed" &&
    r.schemaVersion === READING_SCHEMA_VERSION &&
    typeof r.chart === "object" &&
    r.chart !== null &&
    typeof r.partner === "object" &&
    r.partner !== null &&
    typeof r.native === "object" &&
    r.native !== null &&
    typeof r.numerology === "object" &&
    r.numerology !== null &&
    Array.isArray(r.warnings) &&
    typeof r.disclaimer === "string"
  );
}

/** Saves the reading to sessionStorage. Never throws (storage may be full or blocked). */
export function saveReading(result: ReadingResult, revealed: boolean): void {
  try {
    window.sessionStorage.setItem(READING_KEY, JSON.stringify({ v: 1, revealed, result }));
  } catch {
    // The reading still works in memory; it just won't survive a refresh.
  }
}

export function loadReading(): StoredReading | null {
  try {
    const raw = window.sessionStorage.getItem(READING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: unknown; revealed?: unknown; result?: unknown };
    if (parsed.v !== 1 || !looksLikeReading(parsed.result)) return null;
    return { result: parsed.result, revealed: parsed.revealed === true };
  } catch {
    return null;
  }
}

export function clearReading(): void {
  try {
    window.sessionStorage.removeItem(READING_KEY);
  } catch {
    // ignore
  }
}

/** "Clear my details": removes saved form progress and the saved reading from this tab. */
export function clearStoredDetails(): void {
  clearProgress();
  clearReading();
}
