/**
 * Chart service: turns a validated, normalized birth input into a ChartResult using the
 * configured ephemeris provider. No interpretation happens here.
 *
 * Every time-dependent quantity is evaluated across the birth-time uncertainty window
 * (exact time ± declared accuracy, the whole local day when the time is unknown, or all
 * possible UTC offsets when the zone is unknown). Values that change within the window
 * are reported as timelines rather than collapsed to a single guess.
 */
import { isoUtc, TZDB_RELIABLE_FROM_YEAR, formatOffset, looksLikeLocalMeanTime, tzdbVersion } from "@/lib/astro/time";
import { rankCharaKarakas, karakaParticipants } from "@/lib/astro/karakas";
import { grahaLabel } from "@/lib/astro/names";
import {
  BODIES,
  NAKSHATRAS,
  SIGNS,
  padaCellFromIndex,
  padaIndexOf,
  placementOf,
  signIndexOf,
  type BodyId,
  type PlanetId,
} from "@/lib/astro/zodiac";
import {
  CHART_SCHEMA_VERSION,
  type AscendantResult,
  type BodyResult,
  type CalculationWarning,
  type ChartResult,
  type ChartSettings,
  type CharaKarakaResult,
  type CoverageItem,
  type CoverageLevel,
  type CurrentSpan,
  type DarakarakaValue,
  type PadaValue,
  type Placement,
  type SeventhHouseResult,
  type SeventhHouseValue,
  type WindowSegment,
} from "@/lib/contracts/chart";
import {
  MAX_ASCENDANT_LATITUDE,
  type EphemerisProvider,
  type InstantPositions,
  type ToleranceKey,
} from "@/server/ephemeris/types";
import { localLabel, type InternalTimeContext, type NormalizedBirth } from "./time-context";
import { memoizeByTime, scanTimeline, type TimelineSegment } from "./timeline";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Grid step for body/karaka timelines: far shorter than the fastest Pada run (Moon ≈ 6 h). */
function bodyGridStep(windowMs: number): number {
  if (windowMs <= 3 * HOUR) return MINUTE;
  if (windowMs <= 30 * HOUR) return 10 * MINUTE;
  return 15 * MINUTE;
}
/** The Ascendant crosses a sign in ≥ ~20 min at |φ| ≤ 66°; it is cheap, so sample every minute. */
const ASCENDANT_GRID_STEP = MINUTE;
const MOON_SPAN_SEARCH_HOURS = 12;
const ASC_SPAN_SEARCH_HOURS = 4;

export function toleranceKeyFor(body: BodyId, nodeType: ChartSettings["nodeType"]): ToleranceKey {
  if (body === "Rahu" || body === "Ketu") return nodeType === "true" ? "TrueNode" : "MeanNode";
  return body;
}

export function toPlacement(longitudeDeg: number): Placement {
  const p = placementOf(longitudeDeg);
  return {
    longitudeDeg: p.longitudeDeg,
    signIndex: p.signIndex,
    signName: p.signName,
    signSanskrit: p.signSanskrit,
    degreeInSign: p.degreeInSign,
    degreeInSignDms: {
      degrees: p.degreeInSignDms.degrees,
      minutes: p.degreeInSignDms.minutes,
      seconds: p.degreeInSignDms.seconds,
    },
    nakshatraIndex: p.nakshatraIndex,
    nakshatraName: p.nakshatraName,
    pada: p.pada,
    padaIndex: p.padaIndex,
    navamsaSignIndex: p.navamsaSignIndex,
    navamsaSignName: p.navamsaSignName,
    nearestPadaBoundaryArcsec: p.boundaries.nearestPadaBoundaryArcsec,
    nearestSignBoundaryArcsec: p.boundaries.nearestSignBoundaryArcsec,
  };
}

export function padaValueOf(padaIndex: number): PadaValue {
  const cell = padaCellFromIndex(padaIndex);
  const signIndex = Math.floor(padaIndex / 9);
  return {
    padaIndex,
    nakshatraIndex: cell.nakshatraIndex,
    nakshatraName: NAKSHATRAS[cell.nakshatraIndex].name,
    pada: cell.pada,
    signIndex,
    signName: SIGNS[signIndex].name,
  };
}

function lonMap(pos: InstantPositions): Record<BodyId, number> {
  const out = {} as Record<BodyId, number>;
  for (const b of BODIES) out[b] = pos.bodies[b].siderealLongitudeDeg;
  return out;
}

function toSegments<K extends string | number, V>(
  segs: TimelineSegment<K>[],
  timeZone: string | null,
  value: (key: K, from: number, to: number) => V,
): WindowSegment<V>[] {
  return segs.map((s) => ({
    fromUtc: isoUtc(s.from),
    toUtc: isoUtc(s.to),
    fromLocal: localLabel(s.from, timeZone),
    toLocal: localLabel(s.to, timeZone),
    value: value(s.key, s.from, s.to),
  }));
}

/** Finds when `keyAt` last changed before `t` and next changes after it, within ±hours. */
function currentSpan<K extends string | number>(
  t: number,
  hours: number,
  keyAt: (t: number) => K,
  step: number,
  timeZone: string | null,
): CurrentSpan {
  const segs = scanTimeline(t - hours * HOUR, t + hours * HOUR, step, keyAt);
  const idx = segs.findIndex((s) => s.from <= t && t < s.to);
  const seg = idx >= 0 ? segs[idx] : segs[segs.length - 1];
  const entered = idx > 0 ? seg.from : null;
  const leaves = idx >= 0 && idx < segs.length - 1 ? seg.to : null;
  return {
    enteredUtc: entered === null ? null : isoUtc(entered),
    enteredLocal: entered === null ? null : localLabel(entered, timeZone),
    leavesUtc: leaves === null ? null : isoUtc(leaves),
    leavesLocal: leaves === null ? null : localLabel(leaves, timeZone),
    searchedHours: hours,
  };
}

export interface ChartComputationInput {
  birth: NormalizedBirth;
  ctx: InternalTimeContext;
  settings: ChartSettings;
  provider: EphemerisProvider;
}

export function computeChart({ birth, ctx, settings, provider }: ChartComputationInput): ChartResult {
  const { nodeType, charaKarakaScheme } = settings;
  const tz = birth.timeZone;
  const windowMs = ctx.windowEnd - ctx.windowStart;
  const step = bodyGridStep(windowMs);
  const refT = ctx.nominalUtc ?? Math.round((ctx.windowStart + ctx.windowEnd) / 2);

  const positions = memoizeByTime((t) => provider.positionsAt(t, { nodeType, withSpeed: false }));
  const nominal = ctx.nominalUtc !== null ? provider.positionsAt(ctx.nominalUtc, { nodeType, withSpeed: true }) : null;
  const reference = nominal ?? provider.positionsAt(refT, { nodeType, withSpeed: true });
  const warnings: CalculationWarning[] = [];
  const tol = (body: BodyId) => provider.toleranceArcsec(toleranceKeyFor(body, nodeType), refT);

  // ---------------------------------------------------------------- bodies
  const bodies: BodyResult[] = BODIES.map((body) => {
    const segs = scanTimeline(ctx.windowStart, ctx.windowEnd, step, (t) =>
      padaIndexOf(positions(t).bodies[body].siderealLongitudeDeg),
    );
    const segments = toSegments(segs, tz, (key) => padaValueOf(key));
    const toleranceArcsec = tol(body);
    const speed = reference.bodies[body].speedDegPerDay;
    const transitionUncertaintyMinutes =
      speed !== null && Math.abs(speed) > 1e-6
        ? Math.round(((toleranceArcsec / 3600 / Math.abs(speed)) * 1440) * 10) / 10
        : null;

    let atBirth: BodyResult["atBirth"] = null;
    let boundarySensitive = false;
    let currentPadaSpan: CurrentSpan | null = null;
    if (nominal) {
      const raw = nominal.bodies[body];
      const placement = toPlacement(raw.siderealLongitudeDeg);
      atBirth = {
        ...placement,
        speedDegPerDay: raw.speedDegPerDay,
        retrograde: raw.speedDegPerDay === null ? null : raw.speedDegPerDay < 0,
      };
      boundarySensitive = placement.nearestPadaBoundaryArcsec < toleranceArcsec;
      if (body === "Moon") {
        currentPadaSpan = currentSpan(
          ctx.nominalUtc as number,
          MOON_SPAN_SEARCH_HOURS,
          (t) => padaIndexOf(positions(t).bodies.Moon.siderealLongitudeDeg),
          10 * MINUTE,
          tz,
        );
      }
    }
    return {
      body,
      atBirth,
      window: {
        segments,
        padaStable: segments.length === 1,
        signStable: new Set(segments.map((s) => s.value.signIndex)).size === 1,
        longitudeAtStartDeg: positions(ctx.windowStart).bodies[body].siderealLongitudeDeg,
        longitudeAtEndDeg: positions(ctx.windowEnd).bodies[body].siderealLongitudeDeg,
      },
      boundarySensitive,
      toleranceArcsec,
      transitionUncertaintyMinutes,
      currentPadaSpan,
    };
  });

  for (const b of bodies) {
    if (b.boundarySensitive && b.atBirth) {
      warnings.push({
        code: "BOUNDARY_SENSITIVE",
        severity: "caution",
        subject: b.body,
        message: `${grahaLabel(b.body)} is ${b.atBirth.nearestPadaBoundaryArcsec.toFixed(2)}″ from a Nakshatra-Pada boundary, inside the engine tolerance of ${b.toleranceArcsec}″. Its Pada (and anything derived from it) could differ under another ephemeris.`,
      });
    }
    if (ctx.basis === "exact_instant" && !b.window.padaStable) {
      warnings.push({
        code: "TIME_SENSITIVE",
        severity: "caution",
        subject: b.body,
        message: `${grahaLabel(b.body)} changes Pada within the stated birth-time accuracy window.`,
      });
    }
  }

  // ---------------------------------------------------------------- ascendant & houses
  const hasCoords = birth.latitude !== null && birth.longitude !== null;
  const polar = hasCoords && Math.abs(birth.latitude as number) > MAX_ASCENDANT_LATITUDE;
  let ascendant: AscendantResult | null = null;
  let seventhHouse: SeventhHouseResult | null = null;

  if (ctx.basis === "exact_instant" && hasCoords && !polar) {
    const lat = birth.latitude as number;
    const lon = birth.longitude as number;
    const nominalUtc = ctx.nominalUtc as number;
    const ascAt = memoizeByTime((t) => provider.ascendantAt(t, lat, lon));
    const ascNominal = ascAt(nominalUtc);
    const placement = toPlacement(ascNominal.siderealLongitudeDeg);
    const ascTol = provider.toleranceArcsec("Ascendant", nominalUtc);
    const ascSegs = scanTimeline(ctx.windowStart, ctx.windowEnd, ASCENDANT_GRID_STEP, (t) =>
      signIndexOf(ascAt(t).siderealLongitudeDeg),
    );
    ascendant = {
      atBirth: placement,
      window: {
        segments: toSegments(ascSegs, tz, (key) => ({ signIndex: key, signName: SIGNS[key].name })),
        signStable: ascSegs.length === 1,
      },
      boundarySensitive: placement.nearestSignBoundaryArcsec < ascTol,
      toleranceArcsec: ascTol,
      ramcDeg: ascNominal.ramcDeg,
      currentSignSpan: currentSpan(
        nominalUtc,
        ASC_SPAN_SEARCH_HOURS,
        (t) => signIndexOf(ascAt(t).siderealLongitudeDeg),
        ASCENDANT_GRID_STEP,
        tz,
      ),
    };
    if (ascendant.boundarySensitive) {
      warnings.push({
        code: "BOUNDARY_SENSITIVE",
        severity: "important",
        subject: "Ascendant",
        message: `The Ascendant is ${placement.nearestSignBoundaryArcsec.toFixed(1)}″ from a sign boundary (engine tolerance ${ascTol}″); every house and the seventh-house lord could change.`,
      });
    }
    if (!ascendant.window.signStable) {
      warnings.push({
        code: "TIME_SENSITIVE",
        severity: "important",
        subject: "Ascendant",
        message:
          "The Ascendant changes sign within the stated birth-time accuracy window, so house-based results depend on the exact time.",
      });
    }

    const seventhValue = (t: number): SeventhHouseValue => {
      const ascSign = signIndexOf(ascAt(t).siderealLongitudeDeg);
      const seventhSignIndex = (ascSign + 6) % 12;
      const lord = SIGNS[seventhSignIndex].lord;
      const lordPadaIndex = padaIndexOf(positions(t).bodies[lord].siderealLongitudeDeg);
      const cell = padaCellFromIndex(lordPadaIndex);
      return {
        seventhSignIndex,
        seventhSignName: SIGNS[seventhSignIndex].name,
        lord,
        lordPadaIndex,
        lordNakshatraName: NAKSHATRAS[cell.nakshatraIndex].name,
        lordPada: cell.pada,
      };
    };
    const svKey = (t: number) => {
      const v = seventhValue(t);
      return `${v.seventhSignIndex}:${v.lordPadaIndex}`;
    };
    const svSegs = scanTimeline(ctx.windowStart, ctx.windowEnd, ASCENDANT_GRID_STEP, svKey);
    const atBirth = (() => {
      const ascSign = placement.signIndex;
      const seventhSignIndex = (ascSign + 6) % 12;
      const lord = SIGNS[seventhSignIndex].lord as PlanetId;
      const lordPlacement = toPlacement((nominal as InstantPositions).bodies[lord].siderealLongitudeDeg);
      return {
        seventhSignIndex,
        seventhSignName: SIGNS[seventhSignIndex].name,
        lord,
        lordPadaIndex: lordPlacement.padaIndex,
        lordNakshatraName: lordPlacement.nakshatraName,
        lordPada: lordPlacement.pada,
      };
    })();
    seventhHouse = {
      houseSystem: "whole_sign",
      atBirth,
      window: {
        segments: toSegments(svSegs, tz, (_key, from, to) => seventhValue(Math.round((from + to) / 2))),
        stable: svSegs.length === 1,
      },
      lordBoundarySensitive: bodies.find((b) => b.body === atBirth.lord)?.boundarySensitive ?? false,
    };
  }

  // ---------------------------------------------------------------- chara karakas
  const participants = karakaParticipants(charaKarakaScheme);
  const dkValue = (t: number): DarakarakaValue & { tie: boolean } => {
    const pos = positions(t);
    const r = rankCharaKarakas(lonMap(pos), charaKarakaScheme);
    const second = r.order[r.order.length - 2].body;
    const cell = padaCellFromIndex(padaIndexOf(pos.bodies[r.darakaraka].siderealLongitudeDeg));
    return {
      body: r.darakaraka,
      padaIndex: cell.padaIndex,
      nakshatraName: NAKSHATRAS[cell.nakshatraIndex].name,
      pada: cell.pada,
      tie: r.lowestGapArcsec < tol(r.darakaraka) + tol(second),
    };
  };
  const dkSegs = scanTimeline(ctx.windowStart, ctx.windowEnd, step, (t) => {
    const v = dkValue(t);
    return `${v.body}:${v.padaIndex}`;
  });
  let karakaAtBirth: CharaKarakaResult["atBirth"] = null;
  let tieToleranceArcsec = 0;
  if (nominal) {
    const r = rankCharaKarakas(lonMap(nominal), charaKarakaScheme);
    const second = r.order[r.order.length - 2].body;
    tieToleranceArcsec = tol(r.darakaraka) + tol(second);
    const placement = toPlacement(nominal.bodies[r.darakaraka].siderealLongitudeDeg);
    karakaAtBirth = {
      order: r.order.map((o) => ({ ...o })),
      darakaraka: {
        body: r.darakaraka,
        padaIndex: placement.padaIndex,
        nakshatraName: placement.nakshatraName,
        pada: placement.pada,
      },
      lowestGapArcsec: r.lowestGapArcsec,
      tie: r.lowestGapArcsec < tieToleranceArcsec,
    };
    if (karakaAtBirth.tie) {
      warnings.push({
        code: "KARAKA_TIE",
        severity: "important",
        subject: "Darakaraka",
        message: `The two lowest Chara Karaka degrees differ by only ${r.lowestGapArcsec.toFixed(2)}″ (within the combined engine tolerance of ${tieToleranceArcsec}″), so the Darakaraka is not determinable.`,
      });
    }
  } else {
    tieToleranceArcsec = Math.max(...participants.map((p) => tol(p))) * 2;
  }
  const charaKarakas: CharaKarakaResult = {
    scheme: charaKarakaScheme,
    nodeType,
    rahuHandling: charaKarakaScheme === "eight_planet" ? "thirty_minus_degree_in_sign" : "excluded",
    atBirth: karakaAtBirth,
    window: {
      segments: toSegments(dkSegs, tz, (_key, from, to) => dkValue(Math.round((from + to) / 2))),
      stable: dkSegs.length === 1,
    },
    tieToleranceArcsec,
  };

  // ---------------------------------------------------------------- context warnings
  if (ctx.basis === "local_day") {
    warnings.push({
      code: "BIRTH_TIME_UNKNOWN",
      severity: "important",
      message:
        "Birth time not provided: the Ascendant, houses and seventh-house lord are not calculated, and positions are shown across the whole birth date.",
    });
  }
  if (birth.accuracy === "within_15_minutes" || birth.accuracy === "within_1_hour") {
    warnings.push({
      code: "BIRTH_TIME_APPROXIMATE",
      severity: "caution",
      message: `The birth time is approximate (${birth.accuracy === "within_1_hour" ? "±60" : "±15"} minutes); values that change inside that window are shown as alternatives.`,
    });
  }
  if (ctx.basis === "utc_window") {
    warnings.push({
      code: "TIME_ZONE_UNKNOWN",
      severity: "important",
      message:
        "No time zone was provided, so the birth instant is uncertain by up to 26 hours. Only placements that stay the same across that range are treated as determined.",
    });
  }
  if (!hasCoords) {
    warnings.push({
      code: "LOCATION_UNKNOWN",
      severity: "caution",
      message: "No birthplace coordinates were provided, so the Ascendant and houses cannot be calculated.",
    });
  }
  if (polar) {
    warnings.push({
      code: "POLAR_LATITUDE",
      severity: "important",
      message: `The Ascendant is not calculated beyond ±${MAX_ASCENDANT_LATITUDE}° latitude, where parts of the zodiac never rise.`,
    });
  }
  if (ctx.dst === "ambiguous_earlier" || ctx.dst === "ambiguous_later") {
    warnings.push({
      code: "DST_AMBIGUOUS_RESOLVED",
      severity: "info",
      message: `The local time occurred twice; the ${ctx.dst === "ambiguous_earlier" ? "earlier" : "later"} occurrence (UTC${formatOffset(ctx.offsetSeconds ?? 0)}) was used as you selected.`,
    });
  }
  if (tz && birth.date.year < TZDB_RELIABLE_FROM_YEAR) {
    warnings.push({
      code: "PRE_1970_TIME_ZONE_DATA",
      severity: "caution",
      message: `Historical time-zone records before ${TZDB_RELIABLE_FROM_YEAR} can be incomplete for some regions. Please check that the UTC offset shown matches local practice at the time of birth.`,
    });
  }
  if (ctx.offsetSeconds !== null && looksLikeLocalMeanTime(ctx.offsetSeconds)) {
    warnings.push({
      code: "LOCAL_MEAN_TIME_OFFSET",
      severity: "caution",
      message: `The time-zone database gives a local-mean-time offset (UTC${formatOffset(ctx.offsetSeconds)}) for this date.`,
    });
  }
  if (birth.date.year >= 2026) {
    warnings.push({
      code: "FUTURE_DELTA_T",
      severity: "info",
      message:
        "For dates from 2026 onward the difference between atomic and Earth-rotation time (ΔT) is extrapolated, which slightly widens the Moon's uncertainty.",
    });
  }
  const fallback = reference.engineFlags.filter((f) => f.ephemerisUsed === "MOSEPH");
  if (fallback.length > 0) {
    warnings.push({
      code: "ENGINE_FALLBACK",
      severity: "important",
      message: "The Swiss Ephemeris data files were not available; its Moshier fallback was used for this calculation.",
    });
  }

  // ---------------------------------------------------------------- coverage
  const moon = bodies.find((b) => b.body === "Moon") as BodyResult;
  const items: CoverageItem[] = [
    { id: "planetary_positions", label: "Planetary positions (D1)", available: true },
    {
      id: "moon_nakshatra_pada",
      label: "Moon Nakshatra and Pada",
      available: moon.window.padaStable,
      reason: moon.window.padaStable ? undefined : "The Moon changes Pada within the birth-time window.",
    },
    {
      id: "ascendant",
      label: "Ascendant (Lagna)",
      available: ascendant !== null,
      reason:
        ascendant !== null
          ? undefined
          : ctx.basis !== "exact_instant"
            ? "Needs a birth time and time zone."
            : !hasCoords
              ? "Needs birthplace coordinates."
              : "Not calculated at polar latitudes.",
    },
    {
      id: "seventh_house_lord",
      label: "Seventh-house sign and lord (whole sign)",
      available: seventhHouse !== null,
      reason: seventhHouse !== null ? undefined : "Depends on the Ascendant.",
    },
    {
      id: "darakaraka",
      label: `Darakaraka (${charaKarakaScheme === "eight_planet" ? "eight" : "seven"}-planet scheme)`,
      available: charaKarakas.window.stable && !(karakaAtBirth?.tie ?? false),
      reason: karakaAtBirth?.tie
        ? "Two Chara Karaka degrees are within engine tolerance."
        : charaKarakas.window.stable
          ? undefined
          : "The Darakaraka or its Pada changes within the birth-time window.",
    },
    {
      id: "navamsa_d9",
      label: "Navamsa (D9) signs",
      available: nominal !== null,
      reason: nominal !== null ? undefined : "Shown only for a stated birth instant.",
    },
    {
      id: "upapada_lagna",
      label: "Upapada Lagna",
      available: false,
      reason: "Not implemented: published calculation variants (exceptions, dual lordship) are unresolved.",
    },
  ];
  const level: CoverageLevel =
    ctx.basis !== "exact_instant" ? "limited" : ascendant !== null ? "full" : "partial";

  const engineFlags = reference.engineFlags.map((f) => ({
    body: f.body,
    returnedFlags: f.returnedFlags,
    ephemerisUsed: f.ephemerisUsed,
  }));

  return {
    schemaVersion: CHART_SCHEMA_VERSION,
    status: "calculated",
    settings,
    time: {
      basis: ctx.basis,
      localDate: birth.dateIso,
      localTime: birth.timeIso,
      timeZone: tz,
      runtimeTimeZone: ctx.runtimeTimeZone,
      utcOffset: ctx.offsetSeconds === null ? null : formatOffset(ctx.offsetSeconds),
      utcOffsetSeconds: ctx.offsetSeconds,
      birthUtc: ctx.nominalUtc === null ? null : isoUtc(ctx.nominalUtc),
      windowStartUtc: isoUtc(ctx.windowStart),
      windowEndUtc: isoUtc(ctx.windowEnd),
      windowReason: ctx.windowReason,
      dst: ctx.dst,
      tzdbVersion: tzdbVersion(),
      julianDayUT: nominal ? nominal.julianDayUT : null,
      julianDayTT: nominal ? nominal.julianDayTT : null,
      deltaTSeconds: nominal ? nominal.deltaTSeconds : null,
    },
    engine: {
      provider: provider.info.id,
      providerName: provider.info.name,
      libraryVersion: provider.info.libraryVersion,
      license: provider.info.license,
      ephemeris: provider.info.ephemeris,
      ayanamshaImplementation: provider.info.ayanamsha,
      ayanamshaDeg: reference.ayanamshaDeg,
      toleranceSource: provider.info.toleranceSource,
      engineFlags,
    },
    bodies,
    ascendant,
    seventhHouse,
    charaKarakas,
    coverage: { level, items },
    warnings,
  };
}
