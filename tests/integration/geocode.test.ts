/**
 * Integration tests for GET /api/v1/geocode, calling the exported route handler with Web
 * Requests. The provider is mocked; no network access happens.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/v1/geocode/route";
import type { ApiFailure, ApiResponse } from "@/lib/contracts/api";
import { resetConfigForTests } from "@/server/config/env";
import { setGeocodeFetchForTests, type GeocodeResponseData } from "@/server/geocode";
import { resetRateLimitersForTests } from "@/server/http/rate-limit";

const { GET } = route;

const MUMBAI = {
  id: 1275339,
  name: "Mumbai",
  latitude: 19.07283,
  longitude: 72.88261,
  timezone: "Asia/Kolkata",
  country: "India",
  admin1: "Maharashtra",
  population: 12691836,
};

function get(query: string | null, headers: Record<string, string> = {}): Request {
  const url = new URL("http://localhost:3000/api/v1/geocode");
  if (query !== null) url.searchParams.set("q", query);
  return new Request(url, { headers });
}

let providerFetch: ReturnType<typeof vi.fn<typeof fetch>>;

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  // Any real network call would fail the test.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new Error("network access is not allowed in tests");
    }),
  );
  resetConfigForTests();
  resetRateLimitersForTests();
  providerFetch = vi.fn<typeof fetch>(async () => Response.json({ results: [MUMBAI] }));
  setGeocodeFetchForTests(providerFetch);
});

afterEach(() => {
  setGeocodeFetchForTests(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetConfigForTests();
  resetRateLimitersForTests();
});

describe("GET /api/v1/geocode", () => {
  it("only exports GET", () => {
    const methods = Object.keys(route).filter((name) => /^[A-Z]+$/.test(name));
    expect(methods).toEqual(["GET"]);
  });

  it("returns place results with attribution", async () => {
    const response = await GET(get("Mumbai"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");

    const body = (await response.json()) as ApiResponse<GeocodeResponseData>;
    expect(body).toEqual({
      ok: true,
      data: {
        results: [
          {
            id: "1275339",
            label: "Mumbai, Maharashtra, India",
            latitude: 19.07283,
            longitude: 72.88261,
            timeZone: "Asia/Kolkata",
            country: "India",
            admin1: "Maharashtra",
            population: 12691836,
          },
        ],
        attribution: "Location data: Open-Meteo, GeoNames (CC BY 4.0)",
      },
    });

    const url = new URL(String(providerFetch.mock.calls[0][0]));
    expect(url.searchParams.get("name")).toBe("Mumbai");
    expect(url.searchParams.get("count")).toBe("8");
    expect(url.searchParams.get("language")).toBe("en");
    expect(url.searchParams.get("format")).toBe("json");
  });

  it("returns an empty list when nothing matches", async () => {
    providerFetch.mockImplementation(async () => Response.json({ generationtime_ms: 0.4 }));
    const body = (await (await GET(get("Zzyzx Qq"))).json()) as ApiResponse<GeocodeResponseData>;
    expect(body.ok && body.data.results).toEqual([]);
  });

  it.each([
    ["a missing q", null],
    ["a one-character q", "M"],
    ["a whitespace-only q", "   "],
    ["an over-long q", "m".repeat(81)],
  ])("returns 422 VALIDATION_ERROR for %s", async (_label, query) => {
    const response = await GET(get(query));
    expect(response.status).toBe(422);
    const body = (await response.json()) as ApiFailure;
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.fieldErrors?.q?.length).toBe(1);
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it("returns 503 GEOCODING_DISABLED when geocoding is disabled", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "disabled");
    resetConfigForTests();
    const response = await GET(get("Mumbai"));
    expect(response.status).toBe(503);
    expect(((await response.json()) as ApiFailure).error.code).toBe("GEOCODING_DISABLED");
    expect(providerFetch).not.toHaveBeenCalled();
  });

  it.each([
    ["an HTTP error", async () => new Response("unavailable", { status: 503 })],
    ["a provider error body", async () => Response.json({ error: true, reason: "bad request" }, { status: 400 })],
    ["malformed JSON", async () => new Response("not json", { status: 200 })],
    [
      "a network failure",
      async () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("returns 502 GEOCODING_FAILED for %s", async (_label, impl) => {
    providerFetch.mockImplementation(impl as typeof fetch);
    const response = await GET(get("Mumbai"));
    expect(response.status).toBe(502);
    const text = await response.text();
    const body = JSON.parse(text) as ApiFailure;
    expect(body.error.code).toBe("GEOCODING_FAILED");
    expect(text).not.toMatch(/bad request|fetch failed|Mumbai/);
  });

  it("rate limits with 429 and Retry-After (bucket 'geocode')", async () => {
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "2");
    resetConfigForTests();
    expect((await GET(get("Mumbai"))).status).toBe(200);
    expect((await GET(get("Mumbai"))).status).toBe(200);
    const limited = await GET(get("Mumbai"));
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(((await limited.json()) as ApiFailure).error.code).toBe("RATE_LIMITED");
    expect(providerFetch).toHaveBeenCalledTimes(2);
  });

  it("counts invalid queries against the limit too", async () => {
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "1");
    resetConfigForTests();
    expect((await GET(get("M"))).status).toBe(422);
    expect((await GET(get("Mumbai"))).status).toBe(429);
  });

  it("keys the limit per client when proxy headers are trusted", async () => {
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "1");
    vi.stubEnv("TRUST_PROXY_HEADERS", "true");
    resetConfigForTests();
    expect((await GET(get("Mumbai", { "x-forwarded-for": "198.51.100.1" }))).status).toBe(200);
    expect((await GET(get("Mumbai", { "x-forwarded-for": "198.51.100.2" }))).status).toBe(200);
    expect((await GET(get("Mumbai", { "x-forwarded-for": "198.51.100.1" }))).status).toBe(429);
  });

  it("returns a generic 500 if configuration is malformed", async () => {
    vi.stubEnv("RATE_LIMIT_GEOCODE_PER_MINUTE", "lots");
    resetConfigForTests();
    const response = await GET(get("Mumbai"));
    expect(response.status).toBe(500);
    expect(((await response.json()) as ApiFailure).error).toEqual({
      code: "INTERNAL_ERROR",
      message: "Something went wrong. Please try again.",
    });
  });

  it("never logs the search text", async () => {
    providerFetch.mockImplementation(async () => new Response("unavailable", { status: 500 }));
    await GET(get("Tiny Hamlet Of Birth"));
    const logged = [...vi.mocked(console.warn).mock.calls, ...vi.mocked(console.error).mock.calls].flat().join(" ");
    expect(logged).not.toContain("Hamlet");
  });
});
