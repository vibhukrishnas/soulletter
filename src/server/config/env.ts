/**
 * Typed, validated server configuration.
 *
 * Configuration is read lazily from `process.env` on first use (never at import time, so
 * `next build` does not need production secrets) and memoized for the life of the
 * process. Every variable has a safe default; see `.env.example` for documentation.
 *
 * Failure policy:
 * - A malformed value for an ordinary variable (e.g. `EPHEMERIS_PROVIDER=foo`) is an
 *   operator error and raises {@link ConfigError}, naming the variable but never echoing
 *   its value.
 * - A missing or weak `SHARE_TOKEN_SECRET` never crashes the app: sharing is reported as
 *   disabled (with a reason) and every other feature keeps working.
 *
 * Never log the resolved configuration: it contains secrets.
 */
import { randomBytes } from "node:crypto";
import { z } from "zod";

export type EphemerisProviderSetting = "astronomy-engine" | "swiss-ephemeris";
export type SwissEphemerisLicense = "agpl" | "professional";
export type GeocodingProviderSetting = "open-meteo" | "disabled";
export type RuntimeEnvironment = "development" | "test" | "production";

/** Free Open-Meteo geocoding endpoint. Licensed for NON-COMMERCIAL use only. */
export const OPEN_METEO_FREE_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
/** Commercial ("customer-") Open-Meteo geocoding endpoint; requires an API key. */
export const OPEN_METEO_CUSTOMER_GEOCODING_URL = "https://customer-geocoding-api.open-meteo.com/v1/search";

/** Minimum length (characters) of `SHARE_TOKEN_SECRET`. */
export const MIN_SHARE_SECRET_LENGTH = 32;
/** Upper bound for every `RATE_LIMIT_*_PER_MINUTE` variable. */
export const MAX_RATE_LIMIT_PER_MINUTE = 1000;

export type ShareConfig =
  | {
      enabled: true;
      /** Secret used to derive the share-token key. Never log or return it. */
      secret: string;
      /**
       * True when the secret was generated for this process because none was configured
       * (development/test only). Share links stop working when the process restarts.
       */
      ephemeral: boolean;
      ttlDays: number;
    }
  | {
      enabled: false;
      /** Operator-facing explanation; safe to log (contains no secret material). */
      reason: string;
      ttlDays: number;
    };

export interface AppConfig {
  runtimeEnvironment: RuntimeEnvironment;
  ephemeris: {
    provider: EphemerisProviderSetting;
    /**
     * Declared Swiss Ephemeris licence. Required when `provider` is "swiss-ephemeris";
     * the ephemeris factory enforces that requirement, this module only reports it.
     */
    swissLicense: SwissEphemerisLicense | null;
    /** Directory containing Swiss Ephemeris data files, if configured. */
    swissPath: string | null;
  };
  share: ShareConfig;
  geocoding: {
    provider: GeocodingProviderSetting;
    /** Fully qualified search endpoint (no query string required). */
    endpoint: string;
    /** Commercial API key; sent as `apikey`. Never log it. */
    apiKey: string | null;
  };
  rateLimits: {
    readingsPerMinute: number;
    geocodePerMinute: number;
    sharePerMinute: number;
  };
  /**
   * When true, the client IP is taken from `X-Forwarded-For` / `X-Real-IP`. Only enable
   * behind a reverse proxy that sets (overwrites) these headers; otherwise clients could
   * spoof them. When false, all clients share the single rate-limit key "global".
   */
  trustProxyHeaders: boolean;
}

/** Raised for malformed configuration. The message names variables, never values. */
export class ConfigError extends Error {
  readonly variables: readonly string[];

  constructor(problems: ReadonlyArray<{ variable: string; problem: string }>) {
    super(
      `Invalid server configuration: ${problems.map((p) => `${p.variable} ${p.problem}`).join("; ")}`,
    );
    this.name = "ConfigError";
    this.variables = problems.map((p) => p.variable);
  }
}

/** Treats unset, empty and whitespace-only variables as "not set". */
function optionalText() {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
    z.string().optional(),
  );
}

function optionalEnum<const T extends readonly [string, ...string[]]>(values: T, problem: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim().toLowerCase() : undefined),
    z.enum(values, { error: problem }).optional(),
  );
}

function optionalInteger(min: number, max: number, problem: string) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string" || value.trim() === "") return undefined;
      const trimmed = value.trim();
      return /^\d{1,9}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
    },
    z.number({ error: problem }).int({ error: problem }).min(min, { error: problem }).max(max, { error: problem }).optional(),
  );
}

function optionalHttpUrl(problem: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : undefined),
    z
      .string()
      .refine((value) => {
        try {
          const url = new URL(value);
          return (url.protocol === "https:" || url.protocol === "http:") && url.username === "" && url.password === "";
        } catch {
          return false;
        }
      }, { error: problem })
      .optional(),
  );
}

const rateLimitProblem = `must be an integer between 1 and ${MAX_RATE_LIMIT_PER_MINUTE}`;

const envSchema = z.object({
  NODE_ENV: optionalText(),
  EPHEMERIS_PROVIDER: optionalEnum(
    ["astronomy-engine", "swiss-ephemeris"],
    'must be "astronomy-engine" or "swiss-ephemeris"',
  ),
  SWISS_EPHEMERIS_LICENSE: optionalEnum(["agpl", "professional"], 'must be "agpl" or "professional"'),
  SWISS_EPHEMERIS_PATH: optionalText(),
  // Validated separately: a weak secret disables sharing instead of failing startup.
  SHARE_TOKEN_SECRET: optionalText(),
  SHARE_TOKEN_TTL_DAYS: optionalInteger(1, 365, "must be an integer between 1 and 365"),
  GEOCODING_PROVIDER: optionalEnum(["open-meteo", "disabled"], 'must be "open-meteo" or "disabled"'),
  OPEN_METEO_API_KEY: optionalText(),
  OPEN_METEO_GEOCODING_URL: optionalHttpUrl("must be an absolute http(s) URL without credentials"),
  RATE_LIMIT_READINGS_PER_MINUTE: optionalInteger(1, MAX_RATE_LIMIT_PER_MINUTE, rateLimitProblem),
  RATE_LIMIT_GEOCODE_PER_MINUTE: optionalInteger(1, MAX_RATE_LIMIT_PER_MINUTE, rateLimitProblem),
  RATE_LIMIT_SHARE_PER_MINUTE: optionalInteger(1, MAX_RATE_LIMIT_PER_MINUTE, rateLimitProblem),
  TRUST_PROXY_HEADERS: optionalEnum(["true", "false"], 'must be "true" or "false"'),
});

export const CONFIG_DEFAULTS = {
  ephemerisProvider: "astronomy-engine",
  shareTokenTtlDays: 30,
  geocodingProvider: "open-meteo",
  readingsPerMinute: 20,
  geocodePerMinute: 30,
  sharePerMinute: 10,
  trustProxyHeaders: false,
} as const;

// The ephemeral development secret lives on globalThis so that every route bundle in the
// same process (and hot-reloaded module instances) seals and opens tokens with one key.
const EPHEMERAL_SECRET_SLOT = Symbol.for("soulletter.config.ephemeralShareSecret");
type GlobalWithSecret = typeof globalThis & { [EPHEMERAL_SECRET_SLOT]?: string };

function ephemeralShareSecret(): string {
  const holder = globalThis as GlobalWithSecret;
  let secret = holder[EPHEMERAL_SECRET_SLOT];
  if (secret === undefined) {
    secret = randomBytes(32).toString("base64url");
    holder[EPHEMERAL_SECRET_SLOT] = secret;
    console.warn(
      "[config] SHARE_TOKEN_SECRET is not set; using an ephemeral per-process secret. " +
        "Share links will stop working when the server restarts.",
    );
  }
  return secret;
}

function runtimeEnvironmentOf(nodeEnv: string | undefined): RuntimeEnvironment {
  // Anything other than an explicit development/test environment is treated as
  // production so that ephemeral secrets can never be used in a deployed build.
  if (nodeEnv === "development" || nodeEnv === "test") return nodeEnv;
  return "production";
}

function resolveShareConfig(
  secret: string | undefined,
  runtimeEnvironment: RuntimeEnvironment,
  ttlDays: number,
): ShareConfig {
  if (secret !== undefined) {
    if (secret.length < MIN_SHARE_SECRET_LENGTH) {
      return {
        enabled: false,
        reason: `SHARE_TOKEN_SECRET must be at least ${MIN_SHARE_SECRET_LENGTH} characters; sharing is disabled.`,
        ttlDays,
      };
    }
    return { enabled: true, secret, ephemeral: false, ttlDays };
  }
  if (runtimeEnvironment === "production") {
    return { enabled: false, reason: "SHARE_TOKEN_SECRET is not set; sharing is disabled.", ttlDays };
  }
  return { enabled: true, secret: ephemeralShareSecret(), ephemeral: true, ttlDays };
}

/**
 * Parses and validates configuration from an environment map. Pure apart from the
 * one-time generation of an ephemeral development share secret.
 *
 * @throws {ConfigError} when a variable has a malformed value.
 */
export function loadConfig(env: Readonly<Record<string, string | undefined>>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => ({
      variable: String(issue.path[0] ?? "environment"),
      problem: issue.message,
    }));
    throw new ConfigError(problems);
  }
  const v = parsed.data;
  const runtimeEnvironment = runtimeEnvironmentOf(v.NODE_ENV);
  const apiKey = v.OPEN_METEO_API_KEY ?? null;

  return {
    runtimeEnvironment,
    ephemeris: {
      provider: v.EPHEMERIS_PROVIDER ?? CONFIG_DEFAULTS.ephemerisProvider,
      swissLicense: v.SWISS_EPHEMERIS_LICENSE ?? null,
      swissPath: v.SWISS_EPHEMERIS_PATH ?? null,
    },
    share: resolveShareConfig(
      v.SHARE_TOKEN_SECRET,
      runtimeEnvironment,
      v.SHARE_TOKEN_TTL_DAYS ?? CONFIG_DEFAULTS.shareTokenTtlDays,
    ),
    geocoding: {
      provider: v.GEOCODING_PROVIDER ?? CONFIG_DEFAULTS.geocodingProvider,
      endpoint:
        v.OPEN_METEO_GEOCODING_URL ??
        (apiKey !== null ? OPEN_METEO_CUSTOMER_GEOCODING_URL : OPEN_METEO_FREE_GEOCODING_URL),
      apiKey,
    },
    rateLimits: {
      readingsPerMinute: v.RATE_LIMIT_READINGS_PER_MINUTE ?? CONFIG_DEFAULTS.readingsPerMinute,
      geocodePerMinute: v.RATE_LIMIT_GEOCODE_PER_MINUTE ?? CONFIG_DEFAULTS.geocodePerMinute,
      sharePerMinute: v.RATE_LIMIT_SHARE_PER_MINUTE ?? CONFIG_DEFAULTS.sharePerMinute,
    },
    trustProxyHeaders:
      v.TRUST_PROXY_HEADERS === undefined ? CONFIG_DEFAULTS.trustProxyHeaders : v.TRUST_PROXY_HEADERS === "true",
  };
}

let cached: AppConfig | null = null;
let reportedConfigError = false;

/**
 * Returns the process-wide configuration, reading `process.env` on first call.
 *
 * @throws {ConfigError} when a variable has a malformed value. The error is reported
 *   once to the server log (variable names only) and re-thrown on every call.
 */
export function getConfig(): AppConfig {
  if (cached) return cached;
  try {
    cached = loadConfig(process.env);
    return cached;
  } catch (error) {
    if (error instanceof ConfigError && !reportedConfigError) {
      reportedConfigError = true;
      console.error(`[config] ${error.message}`);
    }
    throw error;
  }
}

/**
 * Test helper: forgets the memoized configuration (so the next {@link getConfig} call
 * re-reads `process.env`) and the ephemeral development share secret.
 */
export function resetConfigForTests(): void {
  cached = null;
  reportedConfigError = false;
  delete (globalThis as GlobalWithSecret)[EPHEMERAL_SECRET_SLOT];
}
