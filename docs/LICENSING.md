# Licensing decisions

Checked 2026-10-13 against official sources (URLs below). This is an engineering summary,
not legal advice.

## Production ephemeris: astronomy-engine 2.1.19 — MIT

- Licence: MIT (Copyright 2019–2025 Don Cross). https://github.com/cosinekitty/astronomy
- Shipped in the production bundle (`dependencies`).
- Accuracy: README states "accurate to within ±1 arcminute"; measured agreement with Swiss
  Ephemeris is far tighter for 1900–2029 (see `docs/CALCULATIONS.md`).
- Maintenance risk: latest release 2.1.19 (2023-12-14), last commit 2025-01-27, and the
  maintainer wrote on 2026-05-29 that they are "no longer actively maintaining Astronomy
  Engine". The version is pinned and guarded by reference tests.

## Reference engine: Swiss Ephemeris via `sweph` 2.10.3-8 — AGPL-3.0 (dev only)

- Swiss Ephemeris is dual-licensed: **AGPL-3.0** or the **Swiss Ephemeris Professional
  License** (https://www.astro.com/swisseph/swephinfo_h.htm). The data files (`*.se1`) are
  part of Swiss Ephemeris under the same terms.
- Astrodienst's terms: the choice "must be made before the software developer distributes
  software containing parts of Swiss Ephemeris to others, and before any public service using
  the developed software is activated"; choosing AGPL obliges the developer "to place his or
  her whole software project under the AGPL or a compatible license".
- Professional License (official shop and the September 2026 contract): **CHF 700**, valid
  for **6 years**, covers server use; API services to third parties require their own
  licence. Older docs quoting CHF 750/400/1550 are out of date.
- `sweph` ≥ 2.10.1 is AGPL-3.0; LGPL-3.0 applies only to professional-licence holders.

**How SoulLetter uses it:** `sweph` is a `devDependency`, the data files are downloaded on
demand to `tools/reference/ephe/` and git-ignored, and `next.config.ts` marks `sweph` as an
external server package. It is used only to generate reference fixtures and run local
cross-checks. A production build installed with `npm ci --omit=dev` does not contain it.

**Using Swiss Ephemeris in production** (`EPHEMERIS_PROVIDER=swiss-ephemeris`) is possible but
deliberately gated: the server refuses to start the provider unless
`SWISS_EPHEMERIS_LICENSE` is set to `agpl` (you will publish the whole service's source under
AGPL-compatible terms) or `professional` (you hold a current Professional License). Do not
deploy it for a proprietary service without the professional licence. Move `sweph` to
`dependencies` only after that decision.

## Geocoding: Open-Meteo Geocoding API

- Free endpoint `geocoding-api.open-meteo.com` is for **non-commercial use only**; commercial
  use (subscriptions, ads, commercial products) needs a paid plan, API key and the
  `customer-` host. Set `OPEN_METEO_API_KEY` for that, or `GEOCODING_PROVIDER=disabled` to
  use manual coordinates only.
- Data: GeoNames, CC BY 4.0; attribution "Location data: Open-Meteo, GeoNames (CC BY 4.0)" is
  shown in the UI.

## Other dependencies

Next.js, React, Tailwind CSS, Framer Motion, zod, react-hook-form (MIT); fonts via
`next/font/google` (SIL Open Font License). `npm audit` reports a high-severity advisory in
`braces` reached only through the ESLint toolchain (`eslint-config-next`), not the runtime.
