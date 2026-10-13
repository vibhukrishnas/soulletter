/**
 * GET /api/v1/geocode?q=<place name>
 *
 * Place autocomplete backed by Open-Meteo (GeoNames data). Responds with
 * ApiResponse<GeocodeResponseData>:
 * - 200 { results, attribution } (results may be empty)
 * - 422 VALIDATION_ERROR when `q` is missing, shorter than 2 or longer than 80 characters
 * - 429 RATE_LIMITED (bucket "geocode")
 * - 502 GEOCODING_FAILED when the provider fails or times out
 * - 503 GEOCODING_DISABLED when GEOCODING_PROVIDER=disabled
 *
 * The search text is personal data (it is often a birthplace) and is never logged.
 * Only GET is exported; Next.js answers other methods with 405.
 */
import { searchPlaces, GEOCODE_ATTRIBUTION, type GeocodeResponseData } from "@/server/geocode";
import { enforceRateLimit } from "@/server/http/rate-limit";
import { jsonError, jsonOk, withErrorBoundary } from "@/server/http/respond";

export const GET = withErrorBoundary("geocode", async (request: Request): Promise<Response> => {
  const limited = enforceRateLimit(request, "geocode");
  if (limited) return limited;

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const result = await searchPlaces(query, { signal: request.signal });

  if (result.ok) {
    const data: GeocodeResponseData = { results: result.results, attribution: GEOCODE_ATTRIBUTION };
    return jsonOk(data);
  }
  switch (result.kind) {
    case "disabled":
      return jsonError(
        "GEOCODING_DISABLED",
        "Place search is not available. Enter the latitude, longitude and time zone manually.",
      );
    case "validation":
      return jsonError("VALIDATION_ERROR", result.message, { fieldErrors: { q: [result.message] } });
    case "provider":
      return jsonError(
        "GEOCODING_FAILED",
        "Place search is temporarily unavailable. Try again, or enter the coordinates and time zone manually.",
      );
  }
});
