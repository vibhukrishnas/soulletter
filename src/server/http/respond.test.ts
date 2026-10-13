import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ApiErrorCode, ApiFailure } from "@/lib/contracts/api";
import {
  API_ERROR_STATUS,
  ApiRouteError,
  INTERNAL_ERROR_MESSAGE,
  jsonError,
  jsonOk,
  statusForErrorCode,
  withErrorBoundary,
  zodErrorToFieldErrors,
} from "./respond";

function expectStandardHeaders(response: Response): void {
  expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("jsonOk", () => {
  it("wraps data in the success envelope", async () => {
    const response = jsonOk({ answer: 42 });
    expect(response.status).toBe(200);
    expectStandardHeaders(response);
    expect(await response.json()).toEqual({ ok: true, data: { answer: 42 } });
  });

  it("accepts a custom status and extra headers but keeps the mandatory headers", async () => {
    const response = jsonOk(null, {
      status: 201,
      headers: { Location: "/s/abc", "Cache-Control": "public, max-age=600", "Content-Type": "text/html" },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("location")).toBe("/s/abc");
    expectStandardHeaders(response);
    expect(await response.json()).toEqual({ ok: true, data: null });
  });
});

describe("jsonError", () => {
  const expected: Record<ApiErrorCode, number> = {
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
  };

  it("exports the documented status map", () => {
    expect(API_ERROR_STATUS).toEqual(expected);
  });

  it.each(Object.entries(expected) as [ApiErrorCode, number][])("maps %s to HTTP %i", async (code, status) => {
    const response = jsonError(code, "Safe message");
    expect(response.status).toBe(status);
    expect(statusForErrorCode(code)).toBe(status);
    expectStandardHeaders(response);
    const body = (await response.json()) as ApiFailure;
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe(code);
    expect(body.error.message).toBe("Safe message");
  });

  it("includes non-empty field errors and details only", async () => {
    const withExtras = (await jsonError("VALIDATION_ERROR", "Check the form", {
      fieldErrors: { "birth.birthDate": ["Enter a real date"] },
      details: { candidates: ["+01:00", "+02:00"] },
    }).json()) as ApiFailure;
    expect(withExtras.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Check the form",
      fieldErrors: { "birth.birthDate": ["Enter a real date"] },
      details: { candidates: ["+01:00", "+02:00"] },
    });

    const withoutExtras = (await jsonError("VALIDATION_ERROR", "x", { fieldErrors: {}, details: {} }).json()) as ApiFailure;
    expect(withoutExtras.error).toEqual({ code: "VALIDATION_ERROR", message: "x" });
  });

  it("sets Retry-After (rounded up, at least 1 s) for RATE_LIMITED", async () => {
    const response = jsonError("RATE_LIMITED", "Slow down", { retryAfterSeconds: 12.2 });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("13");
    const body = (await response.json()) as ApiFailure;
    expect(body.error.retryAfterSeconds).toBe(13);

    expect(jsonError("RATE_LIMITED", "Slow down", { retryAfterSeconds: 0 }).headers.get("retry-after")).toBe("1");
  });

  it("always sends Retry-After for RATE_LIMITED, defaulting to 60 s", () => {
    expect(jsonError("RATE_LIMITED", "Slow down").headers.get("retry-after")).toBe("60");
  });

  it("passes extra headers such as Allow", () => {
    const response = jsonError("METHOD_NOT_ALLOWED", "Use GET", { headers: { Allow: "GET" } });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});

describe("zodErrorToFieldErrors", () => {
  const schema = z
    .object({
      birth: z.object({ place: z.object({ timeZone: z.string().min(3, { error: "Too short" }) }) }),
      ids: z.array(z.string().max(2, { error: "Too long" })),
    })
    .strict()
    .superRefine((value, ctx) => {
      ctx.addIssue({ code: "custom", message: "Form-level problem" });
      ctx.addIssue({ code: "custom", message: "Form-level problem" });
      if (value.ids.length > 1) ctx.addIssue({ code: "custom", path: ["ids", 1], message: "Duplicate" });
    });

  it("keys messages by dotted path, uses _form for root issues and removes duplicates", () => {
    const parsed = schema.safeParse({ birth: { place: { timeZone: "x" } }, ids: ["ok", "toolong"] });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    // zod v4 still runs refinements after non-fatal (length) issues, so messages merge.
    expect(zodErrorToFieldErrors(parsed.error)).toEqual({
      "birth.place.timeZone": ["Too short"],
      "ids.1": ["Too long", "Duplicate"],
      _form: ["Form-level problem"],
    });

    const refined = schema.safeParse({ birth: { place: { timeZone: "UTC" } }, ids: ["a", "b"] });
    if (refined.success) throw new Error("expected failure");
    expect(zodErrorToFieldErrors(refined.error)).toEqual({ _form: ["Form-level problem"], "ids.1": ["Duplicate"] });
  });

  it("reports unrecognized keys of strict objects", () => {
    const parsed = schema.safeParse({ birth: { place: { timeZone: "UTC" } }, ids: [], extra: true });
    if (parsed.success) throw new Error("expected failure");
    const fieldErrors = zodErrorToFieldErrors(parsed.error);
    expect(Object.keys(fieldErrors)).toEqual(["_form"]);
    expect(fieldErrors._form[0]).toMatch(/extra/);
  });

  it("accepts structural issue lists including symbol path segments", () => {
    const sym = Symbol("meta");
    expect(
      zodErrorToFieldErrors({ issues: [{ path: ["a", 0, sym], message: "Bad" }, { path: [], message: "Root" }] }),
    ).toEqual({ "a.0.meta": ["Bad"], _form: ["Root"] });
  });
});

describe("withErrorBoundary", () => {
  it("returns the handler's response and forwards arguments", async () => {
    const handler = withErrorBoundary("echo", async (request: Request, context: { params: Promise<{ id: string }> }) => {
      const { id } = await context.params;
      return jsonOk({ id, method: request.method });
    });
    const response = await handler(new Request("http://localhost/x"), { params: Promise.resolve({ id: "7" }) });
    expect(await response.json()).toEqual({ ok: true, data: { id: "7", method: "GET" } });
  });

  it("converts thrown errors into a generic 500 and logs only the class name", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    class SecretLeakError extends Error {}
    const handler = withErrorBoundary("readings", () => {
      throw new SecretLeakError("birth date 1990-01-01 in Delhi with key sk_live_123");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    expectStandardHeaders(response);
    const text = await response.text();
    expect(text).not.toContain("1990");
    expect(text).not.toContain("sk_live");
    expect(text).not.toContain("SecretLeakError");
    expect(JSON.parse(text)).toEqual({ ok: false, error: { code: "INTERNAL_ERROR", message: INTERNAL_ERROR_MESSAGE } });
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("[api] readings failed: SecretLeakError");
  });

  it("handles rejected promises and non-Error throws", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rejecting = withErrorBoundary("a", async () => {
      throw new TypeError("x");
    });
    expect((await rejecting()).status).toBe(500);
    expect(log).toHaveBeenLastCalledWith("[api] a failed: TypeError");

    const throwsString = withErrorBoundary("b", () => {
      throw "private string value";
    });
    expect((await throwsString()).status).toBe(500);
    expect(log).toHaveBeenLastCalledWith("[api] b failed: non-error string");
  });

  it("maps ApiRouteError to its typed response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const notFound = withErrorBoundary("share", () => {
      throw new ApiRouteError("SHARE_TOKEN_EXPIRED", "This link has expired.", { details: { kind: "share" } });
    });
    const response = await notFound();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({
      ok: false,
      error: { code: "SHARE_TOKEN_EXPIRED", message: "This link has expired.", details: { kind: "share" } },
    });
    expect(log).not.toHaveBeenCalled();

    const serverSide = withErrorBoundary("readings", () => {
      throw new ApiRouteError("ENGINE_UNAVAILABLE", "The calculation engine is unavailable.");
    });
    expect((await serverSide()).status).toBe(503);
    expect(log).toHaveBeenCalledWith("[api] readings failed: ApiRouteError(ENGINE_UNAVAILABLE)");
  });
});
