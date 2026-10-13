import { getEphemerisProvider } from "@/server/ephemeris/factory";
import type { EphemerisProvider } from "@/server/ephemeris/types";
import { jsonError } from "./respond";

/** Loads the configured provider or returns a safe 503 (details only in server logs). */
export async function loadProvider(): Promise<{ ok: true; provider: EphemerisProvider } | { ok: false; response: Response }> {
  try {
    return { ok: true, provider: await getEphemerisProvider() };
  } catch (error) {
    console.error(`[api] ephemeris provider unavailable: ${error instanceof Error ? error.name : "unknown"}`);
    return {
      ok: false,
      response: jsonError("ENGINE_UNAVAILABLE", "The calculation engine is not available right now. Please try again later."),
    };
  }
}
