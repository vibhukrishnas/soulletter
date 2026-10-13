import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  OPEN_METEO_CUSTOMER_GEOCODING_URL,
  OPEN_METEO_FREE_GEOCODING_URL,
  resetConfigForTests,
} from "@/server/config/env";
import { isGeocodingEnabled, searchPlaces, setGeocodeFetchForTests } from "./index";

const TOKYO = {
  id: 1850147,
  name: "Tokyo",
  latitude: 35.6895,
  longitude: 139.69171,
  timezone: "Asia/Tokyo",
  country: "Japan",
  admin1: "Tokyo",
  population: 8336599,
};

function okFetch() {
  return vi.fn<typeof fetch>(async () => Response.json({ results: [TOKYO] }));
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  resetConfigForTests();
});

afterEach(() => {
  setGeocodeFetchForTests(null);
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  resetConfigForTests();
});

describe("searchPlaces", () => {
  it("searches the free endpoint by default", async () => {
    const fetchImpl = okFetch();
    const result = await searchPlaces("  Tokyo ", { fetchImpl });
    expect(result).toEqual({ ok: true, results: [expect.objectContaining({ id: "1850147", label: "Tokyo, Japan" })] });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(OPEN_METEO_FREE_GEOCODING_URL);
    expect(url.searchParams.get("name")).toBe("Tokyo");
    expect(url.searchParams.has("apikey")).toBe(false);
  });

  it("uses the commercial host and API key when OPEN_METEO_API_KEY is set", async () => {
    vi.stubEnv("OPEN_METEO_API_KEY", "commercial-key");
    resetConfigForTests();
    const fetchImpl = okFetch();
    await searchPlaces("Tokyo", { fetchImpl });
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.origin + url.pathname).toBe(OPEN_METEO_CUSTOMER_GEOCODING_URL);
    expect(url.searchParams.get("apikey")).toBe("commercial-key");
  });

  it("returns a validation failure without calling the provider", async () => {
    const fetchImpl = okFetch();
    expect(await searchPlaces("T", { fetchImpl })).toEqual({
      ok: false,
      kind: "validation",
      message: expect.stringMatching(/at least 2/),
    });
    expect(await searchPlaces("x".repeat(81), { fetchImpl })).toMatchObject({ ok: false, kind: "validation" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports when geocoding is disabled", async () => {
    vi.stubEnv("GEOCODING_PROVIDER", "disabled");
    resetConfigForTests();
    const fetchImpl = okFetch();
    expect(isGeocodingEnabled()).toBe(false);
    expect(await searchPlaces("Tokyo", { fetchImpl })).toEqual({ ok: false, kind: "disabled" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps provider failures", async () => {
    const fetchImpl: typeof fetch = async () => new Response("down", { status: 503 });
    expect(await searchPlaces("Tokyo", { fetchImpl })).toEqual({ ok: false, kind: "provider", reason: "http_status" });
  });

  it("uses the test fetch override, then the global fetch", async () => {
    const globalFetch = vi.fn<typeof fetch>(async () => Response.json({ results: [] }));
    vi.stubGlobal("fetch", globalFetch);

    const override = okFetch();
    setGeocodeFetchForTests(override);
    expect(await searchPlaces("Tokyo")).toMatchObject({ ok: true, results: [{ id: "1850147" }] });
    expect(override).toHaveBeenCalledTimes(1);
    expect(globalFetch).not.toHaveBeenCalled();

    setGeocodeFetchForTests(null);
    expect(await searchPlaces("Tokyo")).toEqual({ ok: true, results: [] });
    expect(globalFetch).toHaveBeenCalledTimes(1);
  });
});
