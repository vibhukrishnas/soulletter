/**
 * JSON response builders for /api/v1 route handlers.
 *
 * Every response produced here carries the shared {@link ApiResponse} envelope and the
 * headers `Content-Type: application/json; charset=utf-8`, `Cache-Control: no-store` and
 * `X-Content-Type-Options: nosniff`. Error responses never contain stack traces,
 * exception messages, request bodies or secrets.
 */
import type { ApiError, ApiErrorCode, ApiFailure, ApiSuccess } from "@/lib/contracts/api";
import { API_ERROR_STATUS, ApiRouteError, type ApiErrorExtras } from "./errors";

export { API_ERROR_STATUS, ApiRouteError, statusForErrorCode, type ApiErrorExtras } from "./errors";

export const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
export const INTERNAL_ERROR_MESSAGE = "Something went wrong. Please try again.";
/** Used when RATE_LIMITED is returned without an explicit retry delay. */
const DEFAULT_RETRY_AFTER_SECONDS = 60;

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  // Applied last so callers cannot accidentally weaken them.
  headers.set("Content-Type", JSON_CONTENT_TYPE);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return headers;
}

/** 200 (or `init.status`) response with `{ ok: true, data }`. */
export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  const body: ApiSuccess<T> = { ok: true, data };
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers: buildHeaders(init?.headers),
  });
}

/**
 * Error response with `{ ok: false, error }` and the status mapped from `code`
 * (see {@link API_ERROR_STATUS}). RATE_LIMITED responses always include `Retry-After`.
 *
 * @param message Safe, user-presentable text. Never pass `error.message` from a caught
 *   exception.
 */
export function jsonError(code: ApiErrorCode, message: string, extras?: ApiErrorExtras): Response {
  const error: ApiError = { code, message };
  if (extras?.fieldErrors && Object.keys(extras.fieldErrors).length > 0) error.fieldErrors = extras.fieldErrors;
  if (extras?.details && Object.keys(extras.details).length > 0) error.details = extras.details;

  const headers = buildHeaders(extras?.headers);
  let retryAfter = extras?.retryAfterSeconds;
  if (code === "RATE_LIMITED" && retryAfter === undefined) retryAfter = DEFAULT_RETRY_AFTER_SECONDS;
  if (retryAfter !== undefined && Number.isFinite(retryAfter)) {
    const seconds = Math.max(1, Math.ceil(retryAfter));
    error.retryAfterSeconds = seconds;
    headers.set("Retry-After", String(seconds));
  }

  const body: ApiFailure = { ok: false, error };
  return new Response(JSON.stringify(body), { status: API_ERROR_STATUS[code], headers });
}

/** Structural subset of a zod (v4) error, so classic and core error types both fit. */
export interface ZodLikeError {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}

/**
 * Converts zod issues into field errors keyed by dotted path ("birth.place.timeZone",
 * "enabledRuleIds.2"). Issues on the root object are keyed "_form". Duplicate messages
 * for the same field are collapsed.
 */
export function zodErrorToFieldErrors(error: ZodLikeError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key =
      issue.path.length === 0
        ? "_form"
        : issue.path.map((segment) => (typeof segment === "symbol" ? segment.description ?? "" : String(segment))).join(".");
    const messages = (result[key] ??= []);
    if (!messages.includes(issue.message)) messages.push(issue.message);
  }
  return result;
}

/** Class name of a thrown value, restricted to identifier characters for safe logging. */
function errorClassName(error: unknown): string {
  let name: string;
  if (error instanceof Error) {
    name = error.constructor?.name || error.name || "Error";
  } else if (error === null) {
    name = "null";
  } else {
    name = `non-error ${typeof error}`;
  }
  return name.replace(/[^A-Za-z0-9_$ -]/g, "").slice(0, 64) || "UnknownError";
}

/**
 * Wraps a route handler so that nothing it throws can leak to the client.
 *
 * - {@link ApiRouteError} becomes the corresponding typed error response (server-side
 *   codes, 5xx, are also logged by class name and code).
 * - Anything else is logged as one line `[api] <routeName> failed: <ErrorClassName>`
 *   (no message, no stack, no request data) and becomes a 500 INTERNAL_ERROR.
 */
export function withErrorBoundary<Args extends unknown[]>(
  routeName: string,
  handler: (...args: Args) => Response | Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiRouteError) {
        if (API_ERROR_STATUS[error.code] >= 500) {
          console.error(`[api] ${routeName} failed: ApiRouteError(${error.code})`);
        }
        return jsonError(error.code, error.message, error.extras);
      }
      console.error(`[api] ${routeName} failed: ${errorClassName(error)}`);
      return jsonError("INTERNAL_ERROR", INTERNAL_ERROR_MESSAGE);
    }
  };
}
