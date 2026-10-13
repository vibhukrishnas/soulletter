import { rankCharaKarakas } from "@/lib/astro/karakas";
import { BODIES, placementOf, type BodyId } from "@/lib/astro/zodiac";
import type { ChartSettings } from "@/lib/contracts/chart";
import type {
  ChartPreview,
  KarakaOption,
  NodeOption,
  PreviewBody,
  PreviewDarakaraka,
  PreviewPlacement,
} from "@/lib/contracts/preview";
import type { EphemerisProvider, InstantPositions } from "@/server/ephemeris/types";
import { computeChart, toleranceKeyFor } from "./compute-chart";
import type { InternalTimeContext, NormalizedBirth } from "./time-context";

const BASE_SETTINGS: ChartSettings = {
  zodiac: "sidereal",
  ayanamsha: "lahiri",
  chart: "D1",
  houseSystem: "whole_sign",
  nodeType: "mean",
  charaKarakaScheme: "seven_planet",
};

function previewPlacement(longitudeDeg: number, toleranceArcsec: number, useSignBoundary = false): PreviewPlacement {
  const p = placementOf(longitudeDeg);
  const distance = useSignBoundary ? p.boundaries.nearestSignBoundaryArcsec : p.boundaries.nearestPadaBoundaryArcsec;
  return {
    longitudeDeg: p.longitudeDeg,
    signIndex: p.signIndex,
    degreeInSign: p.degreeInSign,
    nakshatraIndex: p.nakshatraIndex,
    nakshatraName: p.nakshatraName,
    pada: p.pada,
    navamsaSignIndex: p.navamsaSignIndex,
    boundarySensitive: distance < toleranceArcsec,
  };
}

/**
 * Live preview of the user's chart: the same verified calculation as /chart, plus the
 * Darakaraka and Rahu for every selectable convention at the stated instant.
 */
export function computePreview(input: {
  birth: NormalizedBirth;
  ctx: InternalTimeContext;
  provider: EphemerisProvider;
}): ChartPreview {
  const { birth, ctx, provider } = input;
  const chart = computeChart({ birth, ctx, settings: BASE_SETTINGS, provider });

  const bodies: PreviewBody[] = chart.bodies.map((b) => ({
    body: b.body,
    atBirth: b.atBirth ? previewPlacement(b.atBirth.longitudeDeg, b.toleranceArcsec) : null,
    retrograde: b.atBirth?.retrograde ?? null,
    spans: b.window.segments.map((s) => ({
      fromLocal: s.fromLocal,
      toLocal: s.toLocal,
      signIndex: s.value.signIndex,
      nakshatraIndex: s.value.nakshatraIndex,
      nakshatraName: s.value.nakshatraName,
      pada: s.value.pada,
    })),
  }));

  const ascReason =
    chart.coverage.items.find((i) => i.id === "ascendant")?.reason ?? "The Ascendant could not be calculated.";
  const lagna = chart.ascendant
    ? {
        atBirth: previewPlacement(chart.ascendant.atBirth.longitudeDeg, chart.ascendant.toleranceArcsec, true),
        reason: null,
        signStable: chart.ascendant.window.signStable,
      }
    : { atBirth: null, reason: ascReason, signStable: false };

  let seventhHouse: ChartPreview["seventhHouse"] = null;
  if (chart.seventhHouse) {
    const lordBody = chart.bodies.find((b) => b.body === chart.seventhHouse?.atBirth.lord);
    if (lordBody?.atBirth) {
      seventhHouse = {
        signIndex: chart.seventhHouse.atBirth.seventhSignIndex,
        lord: chart.seventhHouse.atBirth.lord,
        lordAtBirth: previewPlacement(lordBody.atBirth.longitudeDeg, lordBody.toleranceArcsec),
      };
    }
  }

  const rahu: Record<NodeOption, PreviewPlacement | null> = { mean: null, true: null };
  const darakaraka: Record<KarakaOption, Record<NodeOption, PreviewDarakaraka | null>> = {
    seven_planet: { mean: null, true: null },
    eight_planet: { mean: null, true: null },
  };

  if (ctx.nominalUtc !== null) {
    const t = ctx.nominalUtc;
    const byNode: Record<NodeOption, InstantPositions> = {
      mean: provider.positionsAt(t, { nodeType: "mean", withSpeed: false }),
      true: provider.positionsAt(t, { nodeType: "true", withSpeed: false }),
    };
    for (const node of ["mean", "true"] as const) {
      const pos = byNode[node];
      const tol = (b: BodyId) => provider.toleranceArcsec(toleranceKeyFor(b, node), t);
      rahu[node] = previewPlacement(pos.bodies.Rahu.siderealLongitudeDeg, tol("Rahu"));
      const longitudes = Object.fromEntries(BODIES.map((b) => [b, pos.bodies[b].siderealLongitudeDeg])) as Record<BodyId, number>;
      for (const scheme of ["seven_planet", "eight_planet"] as const) {
        const r = rankCharaKarakas(longitudes, scheme);
        const second = r.order[r.order.length - 2].body;
        const placement = previewPlacement(longitudes[r.darakaraka], tol(r.darakaraka));
        darakaraka[scheme][node] = {
          body: r.darakaraka,
          nakshatraName: placement.nakshatraName,
          pada: placement.pada,
          tie: r.lowestGapArcsec < tol(r.darakaraka) + tol(second),
          boundarySensitive: placement.boundarySensitive,
        };
      }
    }
  }

  return {
    basis: chart.time.basis,
    birthUtc: chart.time.birthUtc,
    localTime: chart.time.localTime,
    timeZone: chart.time.timeZone,
    utcOffset: chart.time.utcOffset,
    julianDayUT: chart.time.julianDayUT,
    ayanamshaDeg: chart.engine.ayanamshaDeg,
    bodies,
    lagna,
    seventhHouse,
    rahu,
    darakaraka,
    coverage: chart.coverage.level,
    warnings: chart.warnings,
  };
}
