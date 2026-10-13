/**
 * HTTP envelope shared by every /api/v1 endpoint. Failures are always typed; a failed
 * calculation can never be returned as `ok: true`.
 */
import type { ReadingResult, ReadingStage } from "./reading";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "AMBIGUOUS_LOCAL_TIME"
  | "NONEXISTENT_LOCAL_TIME"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_JSON"
  | "RATE_LIMITED"
  | "CALCULATION_FAILED"
  | "ENGINE_UNAVAILABLE"
  | "NOT_FOUND"
  | "SHARE_DISABLED"
  | "SHARE_TOKEN_INVALID"
  | "SHARE_TOKEN_EXPIRED"
  | "GEOCODING_DISABLED"
  | "GEOCODING_FAILED"
  | "METHOD_NOT_ALLOWED"
  | "INTERNAL_ERROR";

export interface ApiError {
  code: ApiErrorCode;
  /** Safe, user-presentable message. Never contains stack traces or secrets. */
  message: string;
  /** Field-level validation messages keyed by dotted path, e.g. "birth.place.timeZone". */
  fieldErrors?: Record<string, string[]>;
  /** Extra safe details, e.g. the two candidate offsets for an ambiguous local time. */
  details?: Record<string, unknown>;
  /** Seconds until retry is allowed (RATE_LIMITED). */
  retryAfterSeconds?: number;
}

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiError };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

/** NDJSON events streamed by POST /api/v1/readings when `Accept: application/x-ndjson`. */
export type ReadingStreamEvent =
  | { type: "stage"; stage: ReadingStage; status: "completed" | "skipped"; detail?: string }
  | { type: "result"; data: ReadingResult }
  | { type: "error"; error: ApiError };

export const NDJSON_CONTENT_TYPE = "application/x-ndjson";
