/**
 * Open-Meteo geocoding client (https://open-meteo.com/en/docs/geocoding-api).
 *
 * LICENSING: the free endpoint (geocoding-api.open-meteo.com) is for non-commercial use
 * only. Commercial deployments must use the "customer-" host with an API key, which the
 * configuration selects automatically when OPEN_METEO_API_KEY is set. Results are based on
 * GeoNames data (CC BY 4.0); the attribution in ./types.ts must be shown with them.
 *
 * Every failure (network, timeout, HTTP status, malformed payload) is returned as a typed
 * value; this module never throws. The search text and API key are never logged.
 */
import { z } from "zod";
import { isValidIanaTimeZone } from "@/lib/astro/time";
import { MAX_PLACE_LABEL_LENGTH } from "@/lib/contracts/input";
import { readStreamWithLimit } from "@/server/http/body";
import { GEOCODE_RESULT_COUNT, type PlaceResult } from "./types";

export const OPEN_METEO_TIMEOUT_MS = 4_000;
/** Upper bound for the provider's response body; real responses are a few kilobytes. */
const MAX_RESPONSE_BYTES = 256 * 1024;
/** Upper bound on raw provider entries inspected per response. */
const MAX_RAW_RESULTS = 100;

export type ProviderFailureReason =
  | "timeout"
  | "aborted"
  | "network"
  | "http_status"
  | "provider_error"
  | "invalid_response";

export type OpenMeteoSearchResult =
  | { ok: true; results: PlaceResult[] }
  | { ok: false; reason: ProviderFailureReason; status?: number };

export interface OpenMeteoSearchOptions {
  /** Search endpoint, e.g. https://geocoding-api.open-meteo.com/v1/search. */
  endpoint: string;
  /** Commercial API key, sent as `apikey` when present. */
  apiKey: string | null;
  fetchImpl?: typeof fetch;
  /** Caller cancellation (e.g. the incoming request's signal). */
  signal?: AbortSignal;
  timeoutMs?: number;
}

const responseSchema = z.object({
  results: z.array(z.unknown()).optional(),
});

const providerErrorSchema = z.object({
  error: z.literal(true),
  reason: z.string().optional(),
});

const optionalText = z.string().max(200).nullish();

const resultItemSchema = z.object({
  id: z.union([z.number().int().nonnegative(), z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)]),
  name: z.string().min(1).max(200),
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string().max(64),
  country: optionalText,
  admin1: optionalText,
  population: z.number().nullish(),
});

// Control characters and angle brackets are not allowed in place labels (see input.ts).
const UNSAFE_TEXT_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029<>]/g;

function cleanText(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFC").replace(UNSAFE_TEXT_RE, " ").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

function truncate(text: string, maxLength: number): string {
  const chars = Array.from(text);
  return chars.length <= maxLength ? text : chars.slice(0, maxLength).join("").trimEnd();
}

/**
 * Builds "Name, Admin1, Country", skipping empty parts and parts that repeat an earlier
 * one (case-insensitively), e.g. "Singapore, Singapore, Singapore" → "Singapore".
 */
export function buildPlaceLabel(name: string, admin1: string | null, country: string | null): string {
  const full = joinDistinct([name, admin1, country]);
  if (Array.from(full).length <= MAX_PLACE_LABEL_LENGTH) return full;
  // Too long for a place label: drop the administrative area, then cut if still needed.
  return truncate(joinDistinct([name, country]), MAX_PLACE_LABEL_LENGTH);
}

function joinDistinct(parts: ReadonlyArray<string | null>): string {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    if (part === null || part === "") continue;
    const key = part.toLocaleLowerCase("en");
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(part);
  }
  return kept.join(", ");
}

/**
 * Maps raw provider entries to {@link PlaceResult}s. Entries that are malformed, have an
 * invalid IANA time zone or out-of-range coordinates, or repeat an earlier id are dropped.
 */
export function mapOpenMeteoResults(rawResults: readonly unknown[], limit = GEOCODE_RESULT_COUNT): PlaceResult[] {
  const places: PlaceResult[] = [];
  const seenIds = new Set<string>();
  for (const raw of rawResults.slice(0, MAX_RAW_RESULTS)) {
    if (places.length >= limit) break;
    const parsed = resultItemSchema.safeParse(raw);
    if (!parsed.success) continue;
    const item = parsed.data;

    const { latitude, longitude } = item;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) continue;
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) continue;
    const timeZone = item.timezone.trim();
    if (!isValidIanaTimeZone(timeZone)) continue;
    const name = cleanText(item.name);
    if (name === null) continue;

    const id = String(item.id);
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const admin1 = cleanText(item.admin1);
    const country = cleanText(item.country);
    const population =
      typeof item.population === "number" && Number.isFinite(item.population) && item.population > 0
        ? Math.round(item.population)
        : null;

    places.push({
      id,
      label: buildPlaceLabel(name, admin1, country),
      latitude,
      longitude,
      timeZone,
      country,
      admin1,
      population,
    });
  }
  return places;
}

/** Request URL for a search. Exposed for tests; contains the API key when configured. */
export function buildOpenMeteoUrl(query: string, endpoint: string, apiKey: string | null): URL {
  const url = new URL(endpoint);
  url.searchParams.set("name", query);
  url.searchParams.set("count", String(GEOCODE_RESULT_COUNT));
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");
  if (apiKey !== null) url.searchParams.set("apikey", apiKey);
  return url;
}

function failure(reason: ProviderFailureReason, status?: number): OpenMeteoSearchResult {
  // Caller cancellation is not a provider problem; everything else is worth one log line.
  if (reason !== "aborted") {
    console.warn(`[geocode] Open-Meteo request failed: ${reason}${status === undefined ? "" : ` (HTTP ${status})`}`);
  }
  return status === undefined ? { ok: false, reason } : { ok: false, reason, status };
}

function parseJson(bytes: Uint8Array): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown };
  } catch {
    return { ok: false };
  }
}

/**
 * Searches Open-Meteo for places matching an already-normalized query.
 * Times out after {@link OPEN_METEO_TIMEOUT_MS} (including reading the body).
 */
export async function searchOpenMeteo(query: string, options: OpenMeteoSearchOptions): Promise<OpenMeteoSearchResult> {
  const { endpoint, apiKey, fetchImpl = globalThis.fetch, signal, timeoutMs = OPEN_METEO_TIMEOUT_MS } = options;
  if (signal?.aborted) return failure("aborted");

  let url: URL;
  try {
    url = buildOpenMeteoUrl(query, endpoint, apiKey);
  } catch {
    return failure("network");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener("abort", onCallerAbort, { once: true });

  const interruption = (): ProviderFailureReason => (timedOut ? "timeout" : signal?.aborted ? "aborted" : "network");

  try {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
        cache: "no-store",
      });
    } catch {
      return failure(interruption());
    }

    const body = await readStreamWithLimit(response.body, MAX_RESPONSE_BYTES);
    if (!body.ok) {
      return failure(body.reason === "too_large" ? "invalid_response" : interruption(), response.status);
    }
    if (timedOut) return failure("timeout");

    const json = parseJson(body.bytes);

    if (!response.ok) {
      if (response.status === 400 && json.ok && providerErrorSchema.safeParse(json.value).success) {
        return failure("provider_error", response.status);
      }
      return failure("http_status", response.status);
    }
    if (!json.ok) return failure("invalid_response", response.status);

    const parsed = responseSchema.safeParse(json.value);
    if (!parsed.success) return failure("invalid_response", response.status);
    return { ok: true, results: mapOpenMeteoResults(parsed.data.results ?? []) };
  } catch {
    // Defensive: nothing above should throw, but this function must never reject.
    return failure("invalid_response");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onCallerAbort);
  }
}
