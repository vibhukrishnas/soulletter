/**
 * Typed browser client for /api/v1. Every failure surfaces as a typed ApiError; a reading
 * is only returned when the server sent a `result` event.
 */
import { NDJSON_CONTENT_TYPE, type ApiError, type ApiResponse, type ReadingStreamEvent } from "@/lib/contracts/api";
import type { ReadingRequest } from "@/lib/contracts/input";
import type { ReadingResult, ReadingStage } from "@/lib/contracts/reading";
import type { CreateShareRequest, CreateShareResponse, ShareCardModel } from "@/lib/contracts/share";
import type { PlaceResult } from "@/server/geocode/types";

export type { PlaceResult };

export class ApiClientError extends Error {
  constructor(readonly error: ApiError, readonly status: number | null) {
    super(error.message);
    this.name = "ApiClientError";
  }
}

const NETWORK_ERROR: ApiError = {
  code: "INTERNAL_ERROR",
  message: "We couldn't reach the calculation service. Check your connection and try again.",
};

async function readEnvelope<T>(res: Response): Promise<T> {
  let body: ApiResponse<T> | null = null;
  try {
    body = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError({ code: "INTERNAL_ERROR", message: "The server sent an unexpected response." }, res.status);
  }
  if (!body || body.ok !== true) {
    throw new ApiClientError(body?.ok === false ? body.error : { code: "INTERNAL_ERROR", message: "Unexpected response." }, res.status);
  }
  return body.data;
}

export type StageHandler = (stage: ReadingStage, status: "completed" | "skipped") => void;

/** Runs a reading with live stage events (NDJSON). Resolves only on a `result` event. */
export async function streamReading(
  request: ReadingRequest,
  onStage: StageHandler,
  signal?: AbortSignal,
): Promise<ReadingResult> {
  let res: Response;
  try {
    res = await fetch("/api/v1/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: NDJSON_CONTENT_TYPE },
      body: JSON.stringify(request),
      signal,
    });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(NETWORK_ERROR, null);
  }
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !type.includes(NDJSON_CONTENT_TYPE) || !res.body) return readEnvelope<never>(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: ReadingResult | null = null;
  let error: ApiError | null = null;
  const handle = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as ReadingStreamEvent;
    if (event.type === "stage") onStage(event.stage, event.status);
    else if (event.type === "result") result = event.data;
    else if (event.type === "error") error = event.error;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) >= 0) {
        handle(buffer.slice(0, idx));
        buffer = buffer.slice(idx + 1);
      }
    }
    handle(buffer);
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(NETWORK_ERROR, res.status);
  }
  if (error) throw new ApiClientError(error, res.status);
  if (!result) throw new ApiClientError({ code: "CALCULATION_FAILED", message: "The calculation did not complete." }, res.status);
  return result;
}


export async function searchPlaces(query: string, signal?: AbortSignal): Promise<{ results: PlaceResult[]; attribution: string }> {
  let res: Response;
  try {
    res = await fetch(`/api/v1/geocode?q=${encodeURIComponent(query)}`, { signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new ApiClientError(NETWORK_ERROR, null);
  }
  return readEnvelope(res);
}

export async function createShareLink(request: CreateShareRequest): Promise<CreateShareResponse> {
  let res: Response;
  try {
    res = await fetch("/api/v1/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch {
    throw new ApiClientError(NETWORK_ERROR, null);
  }
  return readEnvelope(res);
}

export async function fetchShareCard(token: string): Promise<{ card: ShareCardModel; expiresAt: string }> {
  const res = await fetch(`/api/v1/share/${encodeURIComponent(token)}`);
  return readEnvelope(res);
}
