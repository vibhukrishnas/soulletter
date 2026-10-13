import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PLACE_LABEL_LENGTH } from "@/lib/contracts/input";
import { OPEN_METEO_FREE_GEOCODING_URL } from "@/server/config/env";
import {
  buildOpenMeteoUrl,
  buildPlaceLabel,
  mapOpenMeteoResults,
  searchOpenMeteo,
  type OpenMeteoSearchOptions,
} from "./open-meteo";

const NEW_DELHI = {
  id: 1261481,
  name: "New Delhi",
  latitude: 28.63576,
  longitude: 77.22445,
  elevation: 214,
  feature_code: "PPLC",
  country_code: "IN",
  admin1_id: 1273293,
  timezone: "Asia/Kolkata",
  population: 317797,
  country_id: 1269750,
  country: "India",
  admin1: "Delhi",
};

const BERLIN = {
  id: 2950159,
  name: "Berlin",
  latitude: 52.52437,
  longitude: 13.41053,
  timezone: "Europe/Berlin",
  population: 3426354,
  country: "Germany",
  admin1: "Berlin",
  postcodes: ["10967"],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function options(fetchImpl: typeof fetch, extra: Partial<OpenMeteoSearchOptions> = {}): OpenMeteoSearchOptions {
  return { endpoint: OPEN_METEO_FREE_GEOCODING_URL, apiKey: null, fetchImpl, ...extra };
}

/** A fetch that never settles until its signal aborts. */
const hangingFetch: typeof fetch = (_input, init) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  });

let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildOpenMeteoUrl", () => {
  it("sets the documented query parameters", () => {
    const url = buildOpenMeteoUrl("São Paulo & co", OPEN_METEO_FREE_GEOCODING_URL, null);
    expect(url.origin + url.pathname).toBe(OPEN_METEO_FREE_GEOCODING_URL);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      name: "São Paulo & co",
      count: "8",
      language: "en",
      format: "json",
    });
  });

  it("adds the API key only when configured", () => {
    const url = buildOpenMeteoUrl("Paris", "https://customer-geocoding-api.open-meteo.com/v1/search", "k-1");
    expect(url.searchParams.get("apikey")).toBe("k-1");
    expect(url.host).toBe("customer-geocoding-api.open-meteo.com");
  });
});

describe("buildPlaceLabel", () => {
  it.each([
    [["New Delhi", "Delhi", "India"], "New Delhi, Delhi, India"],
    [["Berlin", "Berlin", "Germany"], "Berlin, Germany"],
    [["Singapore", "Singapore", "Singapore"], "Singapore"],
    [["Monaco", null, "monaco"], "Monaco"],
    [["Nowhere", null, null], "Nowhere"],
  ] as const)("%j → %j", ([name, admin1, country], expected) => {
    expect(buildPlaceLabel(name, admin1, country)).toBe(expected);
  });

  it("keeps labels within the place-label limit, dropping the region first", () => {
    const label = buildPlaceLabel("N".repeat(100), "R".repeat(100), "Country");
    expect(label).toBe(`${"N".repeat(100)}, Country`);
    const cut = buildPlaceLabel("N".repeat(200), null, "Country");
    expect(cut).toHaveLength(MAX_PLACE_LABEL_LENGTH);
  });
});

describe("mapOpenMeteoResults", () => {
  it("maps provider entries to PlaceResult", () => {
    expect(mapOpenMeteoResults([NEW_DELHI, BERLIN])).toEqual([
      {
        id: "1261481",
        label: "New Delhi, Delhi, India",
        latitude: 28.63576,
        longitude: 77.22445,
        timeZone: "Asia/Kolkata",
        country: "India",
        admin1: "Delhi",
        population: 317797,
      },
      {
        id: "2950159",
        label: "Berlin, Germany",
        latitude: 52.52437,
        longitude: 13.41053,
        timeZone: "Europe/Berlin",
        country: "Germany",
        admin1: "Berlin",
        population: 3426354,
      },
    ]);
  });

  it("uses null for missing country, region and population", () => {
    const [place] = mapOpenMeteoResults([
      { id: 1, name: "Atoll", latitude: 1, longitude: 2, timezone: "Pacific/Tarawa", population: 0, admin1: "" },
    ]);
    expect(place).toMatchObject({ label: "Atoll", country: null, admin1: null, population: null });
  });

  it("drops entries with invalid time zones, coordinates or shape", () => {
    const results = mapOpenMeteoResults([
      { ...BERLIN, id: 1, timezone: "+05:30" },
      { ...BERLIN, id: 2, timezone: "Mars/Olympus_Mons" },
      { ...BERLIN, id: 3, timezone: undefined },
      { ...BERLIN, id: 4, latitude: 91 },
      { ...BERLIN, id: 5, longitude: -180.5 },
      { ...BERLIN, id: 6, latitude: "52.5" },
      { ...BERLIN, id: 7, name: "" },
      { ...BERLIN, id: -8 },
      null,
      "Berlin",
      { ...BERLIN, id: 9 },
    ]);
    expect(results.map((r) => r.id)).toEqual(["9"]);
  });

  it("removes duplicate ids and caps the number of results", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...BERLIN, id: i < 2 ? 1 : i }));
    const results = mapOpenMeteoResults(many);
    expect(results).toHaveLength(8);
    expect(new Set(results.map((r) => r.id)).size).toBe(8);
  });

  it("strips markup and control characters from labels", () => {
    const [place] = mapOpenMeteoResults([
      { ...BERLIN, name: "<script>Ber\u0000lin</script>", admin1: "  Land\tBerlin ", country: "Germany" },
    ]);
    expect(place.label).not.toMatch(/[<>\u0000-\u001f]/);
    expect(place.admin1).toBe("Land Berlin");
  });
});

describe("searchOpenMeteo", () => {
  it("returns mapped results for a successful response", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [NEW_DELHI], generationtime_ms: 0.5 }));
    const result = await searchOpenMeteo("New Delhi", options(fetchImpl));
    expect(result).toEqual({ ok: true, results: [expect.objectContaining({ label: "New Delhi, Delhi, India" })] });

    const [input, init] = fetchImpl.mock.calls[0];
    const url = new URL(String(input));
    expect(url.searchParams.get("name")).toBe("New Delhi");
    expect(url.searchParams.has("apikey")).toBe(false);
    expect(init?.method).toBe("GET");
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("sends the API key to the configured endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => jsonResponse({ results: [] }));
    await searchOpenMeteo("Paris", options(fetchImpl, { endpoint: "https://geo.example.test/v1/search", apiKey: "secret-key" }));
    const url = new URL(String(fetchImpl.mock.calls[0][0]));
    expect(url.host).toBe("geo.example.test");
    expect(url.searchParams.get("apikey")).toBe("secret-key");
  });

  it("treats a missing results array as no matches", async () => {
    const result = await searchOpenMeteo("Qwxyz", options(async () => jsonResponse({ generationtime_ms: 0.3 })));
    expect(result).toEqual({ ok: true, results: [] });
  });

  it("reports provider errors (HTTP 400 with error/reason)", async () => {
    const fetchImpl: typeof fetch = async () => jsonResponse({ error: true, reason: "Parameter count must be..." }, 400);
    expect(await searchOpenMeteo("Paris", options(fetchImpl))).toEqual({
      ok: false,
      reason: "provider_error",
      status: 400,
    });
  });

  it.each([
    ["HTTP 500", async () => new Response("oops", { status: 500 }), "http_status"],
    ["HTTP 429", async () => jsonResponse({ error: true, reason: "limit" }, 429), "http_status"],
    ["HTTP 400 without an error body", async () => new Response("bad", { status: 400 }), "http_status"],
    ["invalid JSON", async () => new Response("<html>", { status: 200 }), "invalid_response"],
    ["a non-array results field", async () => jsonResponse({ results: { a: 1 } }), "invalid_response"],
    ["a JSON array body", async () => jsonResponse([1, 2]), "invalid_response"],
    [
      "an oversized body",
      async () => new Response(JSON.stringify({ results: [], pad: "x".repeat(300 * 1024) }), { status: 200 }),
      "invalid_response",
    ],
  ] as const)("returns a typed failure for %s", async (_label, fetchImpl, reason) => {
    const result = await searchOpenMeteo("Paris", options(fetchImpl as typeof fetch));
    expect(result).toMatchObject({ ok: false, reason });
  });

  it("returns a network failure when fetch rejects", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await searchOpenMeteo("Paris", options(fetchImpl))).toEqual({ ok: false, reason: "network" });
  });

  it("times out slow requests", async () => {
    const started = Date.now();
    const result = await searchOpenMeteo("Paris", options(hangingFetch, { timeoutMs: 30 }));
    expect(result).toEqual({ ok: false, reason: "timeout" });
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("times out when the body stalls after the headers arrive", async () => {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"results":['));
          init?.signal?.addEventListener("abort", () => controller.error(new DOMException("aborted", "AbortError")));
        },
      });
      return new Response(body, { status: 200 });
    };
    expect(await searchOpenMeteo("Paris", options(fetchImpl, { timeoutMs: 30 }))).toMatchObject({
      ok: false,
      reason: "timeout",
    });
  });

  it("stops when the caller aborts", async () => {
    const controller = new AbortController();
    const pending = searchOpenMeteo("Paris", options(hangingFetch, { signal: controller.signal }));
    controller.abort();
    expect(await pending).toEqual({ ok: false, reason: "aborted" });

    const fetchImpl = vi.fn<typeof fetch>();
    expect(await searchOpenMeteo("Paris", options(fetchImpl, { signal: AbortSignal.abort() }))).toEqual({
      ok: false,
      reason: "aborted",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never logs the query or the API key", async () => {
    const fetchImpl: typeof fetch = async () => new Response("oops", { status: 503 });
    await searchOpenMeteo("Secret Village", options(fetchImpl, { apiKey: "key-xyz" }));
    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("http_status");
    expect(logged).not.toContain("Secret");
    expect(logged).not.toContain("key-xyz");
  });
});
