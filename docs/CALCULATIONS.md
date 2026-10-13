# Calculation integrity and verification

This document records how SoulLetter calculates charts, which conventions are used, how the
results were verified, and what remains unverified. Everything described here is implemented
in `src/lib/astro`, `src/server/ephemeris`, `src/server/chart` and is covered by tests.

## 1. Pipeline

| Step | Implementation | Notes |
|---|---|---|
| Validate input | `src/lib/contracts/input.ts` (zod, shared client/server) | Real calendar dates 1800–2100, 24-hour times, IANA zone names only (raw offsets such as `+05:30` are rejected), coordinate ranges, coordinates require a zone. Nothing is silently corrected. |
| Historical UTC offset | `src/lib/astro/time.ts` | IANA tz database bundled with the runtime's ICU (`process.versions.tz`, recorded in every chart). DST gaps → `NONEXISTENT_LOCAL_TIME`; DST overlaps → `AMBIGUOUS_LOCAL_TIME` unless the user chose *earlier/later*. Pre-1970 and local-mean-time offsets add warnings. |
| UTC → Julian Day | astronomy-engine `AstroTime` (`ut + 2451545`) | Independently checked against Meeus' algorithm (ch. 7) and the Unix-epoch formula. |
| Planet positions | `AstronomyEngineProvider` | Apparent geocentric longitude on the true ecliptic/equinox of date (light-time + aberration). The Moon is evaluated at *t − τ* (light time). |
| Lahiri ayanamsha | `src/lib/astro/ayanamsha.ts` | Reproduces Swiss Ephemeris `SE_SIDM_LAHIRI` (see §2). Sidereal λ = λ(true) − Δψ − A(t). |
| Ascendant | `src/lib/astro/spherical.ts` | `atan2(cos θ, −(sin θ cos ε + tan φ sin ε))` with apparent sidereal time and true obliquity. Not computed beyond ±66° latitude. |
| Nodes | Mean node (Meeus 47.7) or osculating true node from the Moon's state vector | Ketu = Rahu + 180°. |
| D1 / Nakshatra / Pada / D9 | `src/lib/astro/zodiac.ts` | Half-open intervals: a boundary belongs to the following cell. Navamsa = Pada index mod 12. |
| Houses / 7th lord | Whole-sign from the sidereal Ascendant; traditional lords (nodes never rule signs) | |
| Chara Karakas | `src/lib/astro/karakas.ts` | Explicit `seven_planet` or `eight_planet` (Rahu at 30° − degree) convention; ties within tolerance are reported, never broken silently. |
| Birth-time uncertainty | `src/server/chart/compute-chart.ts`, `timeline.ts` | Every quantity is evaluated over the uncertainty window (±1 min for a recorded time, ±15/±60 min for approximate times, the whole local day when unknown, ±12/14 h of every offset when the zone is unknown). Changes are located by bisection to 1 s and reported as time-conditional segments. |

Full precision is kept internally. Rounding happens only in display formatters.

## 2. Lahiri ayanamsha definition

Swiss Ephemeris 2.10 defines `SE_SIDM_LAHIRI` as 23.250182778° true (23.245524743° mean) at
JD 2435553.5 TT (1956-03-21, Indian Calendar Reform Committee), tied to IAU 1976 precession.
Its `get_aya_correction()` anchors the value at J2000 with IAU 1976 precession and propagates
with the current model. SoulLetter implements exactly that:

```
A(t) = 23.245524743° + [p76(J2000) − p76(t0)] + p06(t)
```

with p76 the IAU 1976 and p06 the IAU 2006 general precession in longitude. Measured
difference from Swiss Ephemeris: **max 0.0005″ over 1800–2100** (12,000 samples).

## 3. Verification against independent implementations

### 3.1 Swiss Ephemeris (SWIEPH data files)

`npm run reference:tolerances` compares the production engine with Swiss Ephemeris 2.10.03
(`sweph`, using the official `sepl_18.se1` / `semo_18.se1` files, SHA-256 pinned in
`tools/reference/download-ephe.mjs`). Returned flags are checked: no sample used the Moshier
fallback. Results (`tools/reference/agreement.json`, 4,000 deterministic samples per band,
sidereal longitude differences in arcseconds):

| Quantity | 1900–2029 max | 1900–2029 median | 1800–1899 max | 2030–2100 max |
|---|---|---|---|---|
| Sun | 2.1 | 0.4 | 2.2 | 6.4 |
| Moon | 5.2 | 0.6 | 8.3 | 70.7 |
| Mercury | 12.0 | 1.6 | 11.7 | 17.3 |
| Venus | 20.3 | 1.0 | 22.7 | 14.9 |
| Mars | 12.5 | 0.9 | 14.3 | 12.6 |
| Jupiter | 10.2 | 2.5 | 10.6 | 9.8 |
| Saturn | 12.8 | 2.5 | 12.8 | 9.2 |
| Mean node | 0.11 | 0.06 | 0.16 | 0.16 |
| True node | 16.7 | 3.3 | 17.7 | 24.0 |
| Ascendant | 51.9 | 0.04 | 2.4 | 36.7 |

The 2030–2100 Moon difference is caused by the two engines' different ΔT extrapolations
(up to 111 s apart). The 1900–2029 Ascendant worst case comes from UT1−UTC (astronomy-engine
treats UTC as UT1) amplified near ±66° latitude.

**Boundary-sensitivity tolerance** = ceil(max × 1.5) per band
(`src/server/ephemeris/engine-tolerances.json`). A placement closer than this to a Pada (or,
for the Ascendant, a sign) boundary is reported as boundary-sensitive and both neighbouring
cells are disclosed.

### 3.2 JPL Horizons

35 apparent geocentric ecliptic longitudes (Sun–Saturn at five instants, 1950–2025) were
fetched from the Horizons API on 2026-10-13 (`tools/reference/horizons/`, raw responses and
query URLs included). Quantity 31 was confirmed empirically to be referred to the true
equinox of date. Every production-engine value lies within the measured tolerance, and the
Swiss Ephemeris reference agrees with Horizons to < 1″ for the reference case.

### 3.3 Published panchang timings

For 1990-10-15 (IST), the production engine reproduces:

- Prokerala (Lahiri): Purva Phalguni from 01:52 to 02:46 next day — computed 01:52 / 02:46.
- Drik Panchang Pada changes ≈ 08:05, 14:17, 20:32 (as quoted in the audit package; the page
  is now behind a CAPTCHA and was not re-fetched) — computed 08:04, 14:17, 20:31.

## 4. Reference case: 15 Oct 1990, 14:30, New Delhi (28.6139 N, 77.2090 E, Asia/Kolkata)

| Output | Production engine | Swiss Ephemeris (SWIEPH) | Status |
|---|---|---|---|
| UTC / offset | 09:00 UTC, +05:30 | — | verified (tzdb) |
| Julian Day (UT) | 2448179.875 | 2448179.8749974 (UT1) | verified |
| Lahiri ayanamsha | 23.7283967° | 23.7283967° | verified |
| Moon | Leo 20°06′52″, Purva Phalguni 3 | Leo 20°06′53″, Purva Phalguni 3 | verified (also matches panchang timings) |
| Ascendant | Capricorn 20°16′16″ | Capricorn 20°16′12″ | verified |
| 7th house / lord | Cancer / Moon | Cancer / Moon | verified |
| Darakaraka (7-planet) | Jupiter | Jupiter | verified |
| Jupiter Pada | Pushya 4 (0.4″ **before** 106°40′) | Ashlesha 1 (1.1″ **after** 106°40′) | **boundary-sensitive — not a golden value** |

The audit package's earlier figures used Swiss Ephemeris' Moshier fallback (Jupiter 0.7″ past
the boundary). With the real data files Swiss puts Jupiter 1.08″ past it, while
astronomy-engine puts it 0.37″ before it. Both are within the measured Jupiter tolerance
(16″), so SoulLetter reports Jupiter as boundary-sensitive and shows both syllables
(Da/डा and Di/डी) for the Darakaraka rule instead of choosing one.

## 5. What is not verified / not implemented

- **The partner-syllable rules themselves.** No classical source or empirical study links the
  seventh lord's or Darakaraka's Pada to a spouse's name. They are labelled experimental.
- **The Avakahada table** is compiled from modern secondary sources (two Roman, two
  Devanagari); no primary classical text was verified. Variants (Shravana, Uttara Bhadrapada 4,
  vowel length in 8 cells) are recorded per cell.
- **Upapada Lagna, Vimshottari Dasha, Nadi rules, Katapayadi, Prasna, palm analysis** are not
  implemented (registered as disabled with reasons).
- astronomy-engine's maintainer stated in May 2026 that the project is no longer actively
  maintained. It is pinned at 2.1.19 and verified by the reference suite; switching providers
  only requires implementing `EphemerisProvider`.
