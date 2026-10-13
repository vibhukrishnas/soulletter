/**
 * Place search service used by GET /api/v1/geocode.
 *
 * Applies configuration (provider on/off, endpoint, API key), validates the search text
 * and delegates to the Open-Meteo client. Every query, provider or network problem is
 * returned as a typed failure; the only exception that can escape is a ConfigError for
 * malformed server configuration.
 */
import { getConfig } from "@/server/config/env";
import { searchOpenMeteo, type ProviderFailureReason } from "./open-meteo";
import { normalizeGeocodeQuery } from "./query";
import type { PlaceResult } from "./types";

export type { PlaceResult, GeocodeResponseData } from "./types";
export {
  GEOCODE_ATTRIBUTION,
  GEOCODE_RESULT_COUNT,
  MAX_GEOCODE_QUERY_LENGTH,
  MIN_GEOCODE_QUERY_LENGTH,
} from "./types";
export { normalizeGeocodeQuery } from "./query";
export type { ProviderFailureReason } from "./open-meteo";

export type GeocodeSearchResult =
  | { ok: true; results: PlaceResult[] }
  | { ok: false; kind: "validation"; message: string }
  | { ok: false; kind: "disabled" }
  | { ok: false; kind: "provider"; reason: ProviderFailureReason };

export interface SearchPlacesOptions {
  /** Fetch implementation override (defaults to the test override, then global fetch). */
  fetchImpl?: typeof fetch;
  /** Cancellation signal, typically the incoming request's `signal`. */
  signal?: AbortSignal;
}

let fetchOverrideForTests: typeof fetch | null = null;

/**
 * Test helper: routes every provider request through `fetchImpl` (pass null to restore
 * the global fetch). Lets route-level tests run without network access.
 */
export function setGeocodeFetchForTests(fetchImpl: typeof fetch | null): void {
  fetchOverrideForTests = fetchImpl;
}

/** Whether place search is enabled by configuration. */
export function isGeocodingEnabled(): boolean {
  return getConfig().geocoding.provider !== "disabled";
}

/**
 * Searches for places matching free text. Rejects text shorter than 2 or longer than 80
 * characters (after normalization) without contacting the provider.
 */
export async function searchPlaces(query: string, options: SearchPlacesOptions = {}): Promise<GeocodeSearchResult> {
  const geocoding = getConfig().geocoding;
  if (geocoding.provider === "disabled") return { ok: false, kind: "disabled" };

  const normalized = normalizeGeocodeQuery(query);
  if (!normalized.ok) return { ok: false, kind: "validation", message: normalized.message };

  const result = await searchOpenMeteo(normalized.query, {
    endpoint: geocoding.endpoint,
    apiKey: geocoding.apiKey,
    fetchImpl: options.fetchImpl ?? fetchOverrideForTests ?? globalThis.fetch,
    signal: options.signal,
  });
  return result.ok ? { ok: true, results: result.results } : { ok: false, kind: "provider", reason: result.reason };
}
