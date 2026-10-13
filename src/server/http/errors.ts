/**
 * HTTP status mapping for the typed API error codes, plus an error class that route code
 * may throw to short-circuit with a specific, safe API error.
 */
import type { ApiErrorCode } from "@/lib/contracts/api";

/** HTTP status for every {@link ApiErrorCode}. Exhaustive by construction. */
export const API_ERROR_STATUS = {
  INVALID_JSON: 400,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  VALIDATION_ERROR: 422,
  AMBIGUOUS_LOCAL_TIME: 422,
  NONEXISTENT_LOCAL_TIME: 422,
  RATE_LIMITED: 429,
  NOT_FOUND: 404,
  SHARE_TOKEN_INVALID: 404,
  SHARE_TOKEN_EXPIRED: 410,
  METHOD_NOT_ALLOWED: 405,
  ENGINE_UNAVAILABLE: 503,
  SHARE_DISABLED: 503,
  GEOCODING_DISABLED: 503,
  GEOCODING_FAILED: 502,
  CALCULATION_FAILED: 500,
  INTERNAL_ERROR: 500,
} as const satisfies Record<ApiErrorCode, number>;

/** Returns the HTTP status associated with an API error code. */
export function statusForErrorCode(code: ApiErrorCode): number {
  return API_ERROR_STATUS[code];
}

/** Safe, client-presentable extras attached to an API error. */
export interface ApiErrorExtras {
  fieldErrors?: Record<string, string[]>;
  details?: Record<string, unknown>;
  /** Seconds until the client may retry; also emitted as the `Retry-After` header. */
  retryAfterSeconds?: number;
  /** Additional response headers (e.g. `Allow` for METHOD_NOT_ALLOWED). */
  headers?: HeadersInit;
}

/**
 * Throw from route code to return a specific API error. `message` (and `extras`) are sent
 * to the client verbatim, so they must be safe, user-presentable text: never include
 * request data, exception messages or stack traces.
 */
export class ApiRouteError extends Error {
  readonly code: ApiErrorCode;
  readonly extras: ApiErrorExtras | undefined;

  constructor(code: ApiErrorCode, message: string, extras?: ApiErrorExtras) {
    super(message);
    this.name = "ApiRouteError";
    this.code = code;
    this.extras = extras;
  }
}
