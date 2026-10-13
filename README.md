# SoulLetter

> Discover your symbolic partner-name initials through your birth chart and numerological profile.

SoulLetter is a mobile-first web app that calculates a sidereal (Lahiri) Vedic birth chart
with an astronomical ephemeris, looks up traditional Avakahada naming syllables, and offers
clearly labelled **experimental symbolic** partner-syllable readings alongside a separate,
deterministic numerology profile.

**It does not predict a future partner.** No scientific method is known to identify a future
partner's name or initial from astrology, numerology or palmistry. The app shows no scores,
probabilities or accuracy figures, never generates random letters, and reports missing or
boundary-sensitive data instead of guessing.

## Quick start

Requirements: Node.js ≥ 22.12 (tested on 24.4), npm.

```bash
npm install
cp .env.example .env.local      # optional; every variable has a safe default
npm run dev                     # http://localhost:3000
```

Production:

```bash
npm run build
SHARE_TOKEN_SECRET=<32+ random chars> npm run start
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server (Turbopack). |
| `npm run build` / `npm run start` | Production build / server. |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules). |
| `npm run typecheck` | `next typegen` + `tsc --noEmit`. |
| `npm test` | Vitest: unit, reference and API integration tests. |
| `npm run test:e2e` | Playwright end-to-end tests against a production build (run `npm run build` first; `npx playwright install chromium` once, or set `E2E_CHANNEL=chrome` / `msedge` to use an installed browser). |
| `npm run verify` | lint + typecheck + tests. |
| `node tools/reference/download-ephe.mjs` | Downloads the Swiss Ephemeris data files (SHA-256 checked) for reference tooling. |
| `npm run reference:tolerances` | Re-measures astronomy-engine vs Swiss Ephemeris and rewrites the tolerance table. |
| `npm run reference:fixtures` | Regenerates the frozen Swiss Ephemeris reference fixtures. |

## Configuration

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Default | Purpose |
|---|---|---|
| `SHARE_TOKEN_SECRET` | unset | ≥ 32 chars. Required in production for share links (otherwise sharing is disabled gracefully). Development uses an ephemeral secret. |
| `SHARE_TOKEN_TTL_DAYS` | 30 | Share-link lifetime. |
| `EPHEMERIS_PROVIDER` | `astronomy-engine` | `swiss-ephemeris` requires `SWISS_EPHEMERIS_LICENSE=agpl\|professional` (see [docs/LICENSING.md](docs/LICENSING.md)). |
| `GEOCODING_PROVIDER` | `open-meteo` | `disabled` turns place search off (manual coordinates still work). The free Open-Meteo endpoint is non-commercial; set `OPEN_METEO_API_KEY` for commercial use. |
| `RATE_LIMIT_*_PER_MINUTE` | 20 / 30 / 10 | Per-process limits for readings, geocoding, sharing. |
| `TRUST_PROXY_HEADERS` | `false` | Set `true` only behind a proxy that overwrites `X-Forwarded-For`. |

No API keys are required to run the app.

## Architecture

```
src/
  lib/astro/         angles, zodiac (Nakshatra/Pada/D9), time zones & Julian Day, Lahiri ayanamsha,
                     Ascendant & node formulas, Chara Karakas            (pure, tested)
  lib/avakahada/     sourced, versioned 108-cell syllable table + transliteration
  lib/numerology/    deterministic numerology (never touches candidates)
  lib/rules/         versioned interpretation registry + validation
  lib/reading/       candidate engine (no scores; boundary/time alternatives disclosed)
  lib/share/         privacy-safe share card model, copy text, canvas PNG renderer
  lib/contracts/     shared zod schemas and result types (client + server)
  lib/client/        browser API client (NDJSON stages) and onboarding form model
  server/ephemeris/  provider interface; astronomy-engine (default) and license-gated Swiss adapters;
                     measured tolerances
  server/chart/      time context (uncertainty windows), timeline scanner, chart assembly
  server/reading/    staged pipeline: validate → chart → indicators → numerology → reading
  server/http, config, share, geocode   typed errors, body limits, rate limiting, env config,
                     AES-GCM share tokens, Open-Meteo client
  app/api/v1/        chart · readings (JSON or NDJSON stream) · numerology · rules · share · share/[token]
                     · geocode · health
  app/               landing, /discover flow, /methodology, /privacy, /s/[token]
tools/reference/     ephemeris measurement & fixture generators, Horizons responses
tests/               reference (Swiss, Horizons, panchang), integration (route handlers), unit, e2e
```

### API

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/chart` | Validated birth data → calculated chart only. |
| `POST /api/v1/chart/preview` | Live preview while the form is filled in: the user's own Rashi, Janma Nakshatra, Lagna, 7th house and lord, plus the Rahu and Darakaraka for every selectable convention. |
| `POST /api/v1/readings` | Chart + rule evaluation + numerology. With `Accept: application/x-ndjson` it streams one `stage` event per completed stage, then one `result` or `error` event. |
| `POST /api/v1/numerology` | Numerology only. |
| `GET /api/v1/rules` | Registry, conventions, Avakahada table, measured tolerances, versions, feature flags. |
| `POST /api/v1/share` | Accepts only table cell ids + rule ids; returns an encrypted, expiring opaque token. |
| `GET /api/v1/share/:token` | Public card fields only. |
| `GET /api/v1/geocode?q=` | Place search (label, coordinates, IANA zone). |

Every failure is a typed envelope `{ ok: false, error: { code, message, fieldErrors?, details? } }`;
stack traces and secrets are never returned or logged.

## Calculation integrity

See [docs/CALCULATIONS.md](docs/CALCULATIONS.md). In short:

- **Engine:** astronomy-engine 2.1.19 (MIT), apparent geocentric positions, Lahiri ayanamsha
  reproducing Swiss Ephemeris `SE_SIDM_LAHIRI` to < 0.001″, whole-sign houses, mean or true node,
  seven- or eight-planet Chara Karakas.
- **Verified** against Swiss Ephemeris 2.10.03 with official data files (12,000 sampled instants;
  1900–2029 maximum differences: Moon 5″, planets ≤ 20″), JPL Horizons, and published panchang
  timings. Placements inside the measured tolerance of a boundary are flagged and both neighbouring
  results are shown.
- **Reference case** 1990-10-15 14:30 IST, New Delhi: Moon Leo / Purva Phalguni 3 (naming syllable
  *Ti* टी), Ascendant Capricorn, 7th lord Moon, Darakaraka Jupiter — whose Pada straddles the
  Pushya/Ashlesha boundary between engines and is therefore reported as boundary-sensitive.
- **Birth-time uncertainty** is modelled explicitly (exact ±1 min, ±15 min, ±60 min, whole day, or
  all UTC offsets) and every value that changes inside the window is shown as a time-conditional
  alternative.

## Your own values, everywhere

Every concept the site mentions is shown with the user's calculated value as soon as the details
allow it, in Sanskrit, Devanagari and English (e.g. *Moon sign: Simha (सिंह) · Leo*,
*Lagna: Makara (मकर) · Capricorn*, *7th lord: Chandra (चन्द्र) · Moon*):

- **Landing "Quick look":** date (+ optional time and time zone) → Moon and Sun Rashi and Janma
  Nakshatra, then continue into the full reading pre-filled.
- **Onboarding:** step 2 shows a live chart summary; step 3 shows each convention with its result
  for this user (Lahiri value for the birth date, Rashi, Lagna and Navamsa, whole-sign 7th house and
  lord) and every option card shows what that option gives (Rahu under mean vs true node,
  Darakaraka under each Chara Karaka scheme, Life Path under each method and master-number policy).
- **Results:** checkpoint, planet table, houses and karakas use the same names.

Values come only from the calculation service (numerology previews run the same deterministic code
in the browser). When the time or zone is unknown, the time-dependent alternatives are listed
instead of a single value.

## Interpretation policy

- Rules live in a versioned registry (`src/lib/rules/registry.ts`) with source, procedure, inputs,
  mapping, verification status and limitations. Disabled rules can never emit a syllable.
- **Native naming syllable** (Moon Nakshatra Pada → Avakahada table): documented tradition, about
  the user, not a partner prediction.
- **Partner syllables** (seventh-house lord's Pada, Darakaraka's Pada): *experimental symbolic
  interpretation*, opt-in with an acknowledgement.
- **Excluded** (registered as disabled): Upapada Lagna, Nadi name rules, rare-syllable substitution,
  name-frequency (Zipf/Bayesian) filtering, Katapayadi reversal, Prasna query time, palm fusion,
  number-to-initial mappings.
- The Avakahada table is **provisional** (two Roman + two Devanagari modern sources; variants
  recorded per cell, never substituted).
- Numerology (Life Path, Mulank, Bhagyank, Pythagorean and Chaldean name numbers) uses declared
  formulas with published worked examples as tests, and never creates or reorders candidates.

## Privacy

No accounts, no database, no analytics. Birth details are sent to the server only to calculate and
are not stored. Form progress stays in the browser's `sessionStorage` until the tab closes or the
user clicks *Clear my details*. Share links carry only an encrypted token containing syllable cell
ids and rule ids. Place search sends the typed place name to Open-Meteo via the server.

## Licensing

See [docs/LICENSING.md](docs/LICENSING.md). The production bundle contains no AGPL code; Swiss
Ephemeris is a dev-only reference tool unless an operator explicitly declares a licence.

## Research inputs

The product requirements, research drafts and the audit package that shaped this implementation are
private working documents and are not published here. The audit's provisional Avakahada mapping is
included as a test fixture (`tests/reference/fixtures/audit-avakahada-mapping.json`) so the syllable
table can be checked against it cell by cell.
