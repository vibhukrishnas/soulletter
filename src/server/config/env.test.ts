import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConfigError,
  getConfig,
  loadConfig,
  OPEN_METEO_CUSTOMER_GEOCODING_URL,
  OPEN_METEO_FREE_GEOCODING_URL,
  resetConfigForTests,
} from "./env";

const STRONG_SECRET = "s".repeat(32) + "-strong-secret-value";

describe("loadConfig", () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetConfigForTests();
    warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetConfigForTests();
  });

  it("applies safe defaults", () => {
    const config = loadConfig({ NODE_ENV: "test" });
    expect(config.runtimeEnvironment).toBe("test");
    expect(config.ephemeris).toEqual({ provider: "astronomy-engine", swissLicense: null, swissPath: null });
    expect(config.geocoding).toEqual({ provider: "open-meteo", endpoint: OPEN_METEO_FREE_GEOCODING_URL, apiKey: null });
    expect(config.rateLimits).toEqual({ readingsPerMinute: 20, geocodePerMinute: 30, sharePerMinute: 10 });
    expect(config.trustProxyHeaders).toBe(false);
    expect(config.share.ttlDays).toBe(30);
  });

  it("treats empty and whitespace-only variables as unset", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      EPHEMERIS_PROVIDER: "",
      OPEN_METEO_API_KEY: "   ",
      SHARE_TOKEN_TTL_DAYS: "",
      TRUST_PROXY_HEADERS: "",
    });
    expect(config.ephemeris.provider).toBe("astronomy-engine");
    expect(config.geocoding.apiKey).toBeNull();
    expect(config.share.ttlDays).toBe(30);
    expect(config.trustProxyHeaders).toBe(false);
  });

  describe("share secret", () => {
    it("uses a configured secret of at least 32 characters", () => {
      const config = loadConfig({ NODE_ENV: "production", SHARE_TOKEN_SECRET: STRONG_SECRET });
      expect(config.share).toEqual({ enabled: true, secret: STRONG_SECRET, ephemeral: false, ttlDays: 30 });
    });

    it("disables sharing (without crashing) when the secret is too short", () => {
      const weak = "too-short-secret";
      const config = loadConfig({ NODE_ENV: "development", SHARE_TOKEN_SECRET: weak });
      expect(config.share.enabled).toBe(false);
      if (!config.share.enabled) {
        expect(config.share.reason).toMatch(/at least 32 characters/);
        expect(config.share.reason).not.toContain(weak);
      }
    });

    it("disables sharing in production when no secret is configured", () => {
      const config = loadConfig({ NODE_ENV: "production" });
      expect(config.share.enabled).toBe(false);
      if (!config.share.enabled) expect(config.share.reason).toMatch(/SHARE_TOKEN_SECRET is not set/);
      expect(warn).not.toHaveBeenCalled();
    });

    it("treats unknown NODE_ENV values as production", () => {
      const config = loadConfig({ NODE_ENV: "staging" });
      expect(config.runtimeEnvironment).toBe("production");
      expect(config.share.enabled).toBe(false);
    });

    it("generates one ephemeral secret per process in development and warns once without printing it", () => {
      const first = loadConfig({ NODE_ENV: "development" });
      const second = loadConfig({ NODE_ENV: "test" });
      expect(first.share.enabled && first.share.ephemeral).toBe(true);
      if (!first.share.enabled || !second.share.enabled) throw new Error("expected sharing to be enabled");
      expect(first.share.secret).toBe(second.share.secret);
      expect(Buffer.from(first.share.secret, "base64url")).toHaveLength(32);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).not.toContain(first.share.secret);
    });

    it("regenerates the ephemeral secret after resetConfigForTests", () => {
      const first = loadConfig({ NODE_ENV: "development" });
      resetConfigForTests();
      const second = loadConfig({ NODE_ENV: "development" });
      if (!first.share.enabled || !second.share.enabled) throw new Error("expected sharing to be enabled");
      expect(first.share.secret).not.toBe(second.share.secret);
    });
  });

  describe("SHARE_TOKEN_TTL_DAYS", () => {
    it("accepts integers from 1 to 365", () => {
      expect(loadConfig({ NODE_ENV: "test", SHARE_TOKEN_TTL_DAYS: "1" }).share.ttlDays).toBe(1);
      expect(loadConfig({ NODE_ENV: "test", SHARE_TOKEN_TTL_DAYS: " 365 " }).share.ttlDays).toBe(365);
    });

    it.each(["0", "366", "1.5", "-3", "abc", "1e2"])("rejects %j without echoing the value", (value) => {
      try {
        loadConfig({ NODE_ENV: "test", SHARE_TOKEN_TTL_DAYS: value });
        expect.unreachable("expected ConfigError");
      } catch (error) {
        expect(error).toBeInstanceOf(ConfigError);
        expect((error as ConfigError).variables).toEqual(["SHARE_TOKEN_TTL_DAYS"]);
        expect((error as Error).message).toContain("SHARE_TOKEN_TTL_DAYS");
        expect((error as Error).message).not.toContain(`"${value}"`);
      }
    });
  });

  describe("ephemeris", () => {
    it("reads the Swiss Ephemeris settings (case-insensitively)", () => {
      const config = loadConfig({
        NODE_ENV: "test",
        EPHEMERIS_PROVIDER: "Swiss-Ephemeris",
        SWISS_EPHEMERIS_LICENSE: "AGPL",
        SWISS_EPHEMERIS_PATH: " /srv/ephe ",
      });
      expect(config.ephemeris).toEqual({ provider: "swiss-ephemeris", swissLicense: "agpl", swissPath: "/srv/ephe" });
    });

    it("does not require a licence at config level (the ephemeris factory enforces it)", () => {
      const config = loadConfig({ NODE_ENV: "test", EPHEMERIS_PROVIDER: "swiss-ephemeris" });
      expect(config.ephemeris.swissLicense).toBeNull();
    });

    it("rejects unknown providers and licences", () => {
      expect(() => loadConfig({ EPHEMERIS_PROVIDER: "jpl" })).toThrow(ConfigError);
      expect(() => loadConfig({ SWISS_EPHEMERIS_LICENSE: "gpl" })).toThrow(/SWISS_EPHEMERIS_LICENSE/);
    });
  });

  describe("geocoding", () => {
    it("switches to the commercial customer host when an API key is configured", () => {
      const config = loadConfig({ NODE_ENV: "test", OPEN_METEO_API_KEY: "key-123" });
      expect(config.geocoding).toEqual({
        provider: "open-meteo",
        endpoint: OPEN_METEO_CUSTOMER_GEOCODING_URL,
        apiKey: "key-123",
      });
    });

    it("lets OPEN_METEO_GEOCODING_URL override the endpoint", () => {
      const config = loadConfig({
        NODE_ENV: "test",
        OPEN_METEO_API_KEY: "key-123",
        OPEN_METEO_GEOCODING_URL: "https://geo.example.test/v1/search",
      });
      expect(config.geocoding.endpoint).toBe("https://geo.example.test/v1/search");
    });

    it("rejects malformed endpoint overrides", () => {
      expect(() => loadConfig({ OPEN_METEO_GEOCODING_URL: "not a url" })).toThrow(/OPEN_METEO_GEOCODING_URL/);
      expect(() => loadConfig({ OPEN_METEO_GEOCODING_URL: "ftp://example.test/" })).toThrow(ConfigError);
      expect(() => loadConfig({ OPEN_METEO_GEOCODING_URL: "https://user:pw@example.test/" })).toThrow(ConfigError);
    });

    it("can be disabled", () => {
      expect(loadConfig({ GEOCODING_PROVIDER: "disabled" }).geocoding.provider).toBe("disabled");
      expect(() => loadConfig({ GEOCODING_PROVIDER: "google" })).toThrow(/GEOCODING_PROVIDER/);
    });
  });

  describe("rate limits and proxy trust", () => {
    it("reads per-minute limits", () => {
      const config = loadConfig({
        RATE_LIMIT_READINGS_PER_MINUTE: "5",
        RATE_LIMIT_GEOCODE_PER_MINUTE: "6",
        RATE_LIMIT_SHARE_PER_MINUTE: "7",
      });
      expect(config.rateLimits).toEqual({ readingsPerMinute: 5, geocodePerMinute: 6, sharePerMinute: 7 });
    });

    it.each(["0", "1001", "ten"])("rejects limit %j", (value) => {
      expect(() => loadConfig({ RATE_LIMIT_GEOCODE_PER_MINUTE: value })).toThrow(/RATE_LIMIT_GEOCODE_PER_MINUTE/);
    });

    it("parses TRUST_PROXY_HEADERS", () => {
      expect(loadConfig({ TRUST_PROXY_HEADERS: "true" }).trustProxyHeaders).toBe(true);
      expect(loadConfig({ TRUST_PROXY_HEADERS: "FALSE" }).trustProxyHeaders).toBe(false);
      expect(() => loadConfig({ TRUST_PROXY_HEADERS: "yes" })).toThrow(/TRUST_PROXY_HEADERS/);
    });

    it("reports every invalid variable at once", () => {
      try {
        loadConfig({ TRUST_PROXY_HEADERS: "maybe", RATE_LIMIT_SHARE_PER_MINUTE: "0" });
        expect.unreachable("expected ConfigError");
      } catch (error) {
        expect((error as ConfigError).variables).toEqual(
          expect.arrayContaining(["TRUST_PROXY_HEADERS", "RATE_LIMIT_SHARE_PER_MINUTE"]),
        );
      }
    });
  });
});

describe("getConfig", () => {
  beforeEach(() => {
    resetConfigForTests();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    resetConfigForTests();
  });

  it("reads process.env lazily and memoizes the result", () => {
    vi.stubEnv("RATE_LIMIT_SHARE_PER_MINUTE", "3");
    const first = getConfig();
    expect(first.rateLimits.sharePerMinute).toBe(3);
    vi.stubEnv("RATE_LIMIT_SHARE_PER_MINUTE", "4");
    expect(getConfig()).toBe(first);
    resetConfigForTests();
    expect(getConfig().rateLimits.sharePerMinute).toBe(4);
  });

  it("throws ConfigError for malformed values and logs the variable names once", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubEnv("EPHEMERIS_PROVIDER", "nonsense-provider");
    expect(() => getConfig()).toThrow(ConfigError);
    expect(() => getConfig()).toThrow(ConfigError);
    expect(error).toHaveBeenCalledTimes(1);
    const logged = String(error.mock.calls[0][0]);
    expect(logged).toContain("EPHEMERIS_PROVIDER");
    expect(logged).not.toContain("nonsense-provider");
  });
});
