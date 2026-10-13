/**
 * Geocoding types and constants shared with the client.
 *
 * This module must stay free of server-only imports (node:*, configuration, fetch
 * helpers) so client components can import these types and constants.
 */

/** A place suggestion returned by GET /api/v1/geocode. */
export interface PlaceResult {
  /** Provider-specific identifier, stable for a given provider. */
  id: string;
  /** Human-readable label, e.g. "New Delhi, Delhi, India" (repeated parts removed). */
  label: string;
  /** WGS84 latitude in degrees, [-90, 90]. */
  latitude: number;
  /** WGS84 longitude in degrees, [-180, 180]. */
  longitude: number;
  /** Valid IANA time-zone identifier, e.g. "Asia/Kolkata". */
  timeZone: string;
  country: string | null;
  /** First-level administrative area (state/province), if known. */
  admin1: string | null;
  /** Population when the provider reports a positive value, otherwise null. */
  population: number | null;
}

/** Attribution that must be displayed with geocoding results. */
export const GEOCODE_ATTRIBUTION = "Location data: Open-Meteo, GeoNames (CC BY 4.0)";

/** `data` payload of a successful GET /api/v1/geocode response. */
export interface GeocodeResponseData {
  results: PlaceResult[];
  attribution: typeof GEOCODE_ATTRIBUTION;
}

/** Accepted search-text length (characters, after normalization). */
export const MIN_GEOCODE_QUERY_LENGTH = 2;
export const MAX_GEOCODE_QUERY_LENGTH = 80;
/** Maximum number of suggestions requested from the provider. */
export const GEOCODE_RESULT_COUNT = 8;
