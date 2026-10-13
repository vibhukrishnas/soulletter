import { getConfig } from "@/server/config/env";
import { AstronomyEngineProvider } from "./astronomy-engine-provider";
import { EngineUnavailableError, type EphemerisProvider } from "./types";

let cached: Promise<EphemerisProvider> | null = null;

/**
 * Returns the configured ephemeris provider.
 *  - "astronomy-engine" (default, MIT): no licence decision needed.
 *  - "swiss-ephemeris": refuses to start unless SWISS_EPHEMERIS_LICENSE declares "agpl"
 *    or "professional" (see docs/LICENSING.md); the AGPL `sweph` package is loaded lazily.
 */
export function getEphemerisProvider(): Promise<EphemerisProvider> {
  if (!cached) {
    cached = createProvider().catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

async function createProvider(): Promise<EphemerisProvider> {
  const { ephemeris } = getConfig();
  if (ephemeris.provider === "astronomy-engine") return new AstronomyEngineProvider();
  if (!ephemeris.swissLicense) {
    throw new EngineUnavailableError(
      "Swiss Ephemeris was selected without declaring SWISS_EPHEMERIS_LICENSE (agpl or professional).",
    );
  }
  const { createSwissProvider } = await import("./swiss-provider");
  return createSwissProvider({ licenseMode: ephemeris.swissLicense, ephemerisPath: ephemeris.swissPath });
}

export function resetEphemerisProviderForTests(): void {
  cached = null;
}
