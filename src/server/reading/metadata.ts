import { AVAKAHADA_ENTRIES, AVAKAHADA_TABLE } from "@/lib/avakahada/table";
import { CHART_SCHEMA_VERSION } from "@/lib/contracts/chart";
import { DEFAULT_CHART_SETTINGS, DEFAULT_NUMEROLOGY_SETTINGS } from "@/lib/contracts/input";
import { READING_SCHEMA_VERSION } from "@/lib/contracts/reading";
import { ORDERING_POLICY } from "@/lib/reading/candidates";
import { DEFAULT_ENABLED_RULE_IDS } from "@/lib/rules/ids";
import { CALCULATION_COMPONENTS, RULES, RULE_SET_VERSION } from "@/lib/rules/registry";
import { APP_VERSION } from "@/lib/version";
import { getConfig } from "@/server/config/env";
import { AstronomyEngineProvider } from "@/server/ephemeris/astronomy-engine-provider";
import { MEASURED_AGREEMENT } from "@/server/ephemeris/engine-tolerances";
import { isShareEnabled } from "@/server/share/token";
import { READING_DISCLAIMER, READING_LIMITATIONS, READING_SOURCES } from "./pipeline";

/** Public, secret-free metadata for the methodology page and clients. */
export function buildRulesMetadata() {
  const config = getConfig();
  const share = isShareEnabled();
  const productionInfo = new AstronomyEngineProvider().info;
  return {
    versions: {
      app: APP_VERSION,
      ruleSet: RULE_SET_VERSION,
      readingSchema: READING_SCHEMA_VERSION,
      chartSchema: CHART_SCHEMA_VERSION,
      avakahadaTable: AVAKAHADA_TABLE.version,
    },
    conventions: {
      defaults: DEFAULT_CHART_SETTINGS,
      numerologyDefaults: DEFAULT_NUMEROLOGY_SETTINGS,
      defaultEnabledRuleIds: DEFAULT_ENABLED_RULE_IDS,
      supported: {
        zodiac: ["sidereal"],
        ayanamsha: ["lahiri"],
        chart: ["D1"],
        houseSystem: ["whole_sign"],
        nodeType: ["mean", "true"],
        charaKarakaScheme: ["seven_planet", "eight_planet"],
      },
    },
    engine: {
      configuredProvider: config.ephemeris.provider,
      production: {
        id: productionInfo.id,
        name: productionInfo.name,
        version: productionInfo.libraryVersion,
        license: productionInfo.license,
        ephemeris: productionInfo.ephemeris,
        ayanamsha: productionInfo.ayanamsha,
      },
      measuredAgreement: {
        generatedAt: MEASURED_AGREEMENT.generatedAt,
        referenceEngine: MEASURED_AGREEMENT.referenceEngine,
        samplesPerBand: MEASURED_AGREEMENT.samplesPerBand,
        method: MEASURED_AGREEMENT.method,
        bands: MEASURED_AGREEMENT.bands,
      },
    },
    calculationComponents: CALCULATION_COMPONENTS,
    rules: RULES,
    avakahada: { ...AVAKAHADA_TABLE, entries: AVAKAHADA_ENTRIES },
    orderingPolicy: ORDERING_POLICY,
    limitations: READING_LIMITATIONS,
    disclaimer: READING_DISCLAIMER,
    sources: READING_SOURCES,
    features: {
      shareLinks: share.enabled ? { enabled: true, ephemeral: share.ephemeral } : { enabled: false },
      placeSearch: { enabled: config.geocoding.provider !== "disabled", attribution: "Location data: Open-Meteo, GeoNames (CC BY 4.0)" },
    },
  };
}

export type RulesMetadata = ReturnType<typeof buildRulesMetadata>;
