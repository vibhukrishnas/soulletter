/**
 * Normalization and validation of place-search text. Pure and client-safe.
 */
import { MAX_GEOCODE_QUERY_LENGTH, MIN_GEOCODE_QUERY_LENGTH } from "./types";

export type NormalizedQueryResult = { ok: true; query: string } | { ok: false; message: string };

// C0 and C1 control characters, DEL, and Unicode line/paragraph separators.
const CONTROL_CHARS_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;
/** Inputs longer than this are rejected before any normalization work is done. */
const MAX_RAW_QUERY_LENGTH = 1024;

/**
 * Normalizes search text (Unicode NFC, control characters replaced by spaces, whitespace
 * collapsed and trimmed) and checks that it is 2–80 characters long.
 */
export function normalizeGeocodeQuery(raw: unknown): NormalizedQueryResult {
  if (typeof raw !== "string") {
    return { ok: false, message: "Enter a place name to search for." };
  }
  if (raw.length > MAX_RAW_QUERY_LENGTH) {
    return { ok: false, message: `Use at most ${MAX_GEOCODE_QUERY_LENGTH} characters.` };
  }
  const query = raw.normalize("NFC").replace(CONTROL_CHARS_RE, " ").replace(/\s+/g, " ").trim();
  const length = [...query].length;
  if (length < MIN_GEOCODE_QUERY_LENGTH) {
    return { ok: false, message: `Type at least ${MIN_GEOCODE_QUERY_LENGTH} characters to search for a place.` };
  }
  if (length > MAX_GEOCODE_QUERY_LENGTH) {
    return { ok: false, message: `Use at most ${MAX_GEOCODE_QUERY_LENGTH} characters.` };
  }
  return { ok: true, query };
}
