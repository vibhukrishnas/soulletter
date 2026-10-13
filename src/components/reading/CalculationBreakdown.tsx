import type { ReactNode } from "react";
import { Badge, CheckIcon, CloseIcon, Disclosure } from "@/components/ui";
import { formatArc, formatDms } from "@/lib/astro/angles";
import type {
  BodyResult,
  ChartResult,
  CoverageItem,
  CurrentSpan,
  EngineMetadata,
  TimeContext,
  WindowSegment,
} from "@/lib/contracts/chart";
import { BASIS_LABEL, DST_LABEL, KARAKA_SCHEME_LABEL, NODE_LABEL, localZoneNote, rangeLabel, utcLabel } from "./format";
import { nakshatraDevanagari } from "@/lib/astro/names";
import type { BodyId } from "@/lib/astro/zodiac";
import { GrahaName, SignName, grahaText, signText } from "./VedicNames";

const GRAHA_KEYS = { Sun: 1, Moon: 1, Mars: 1, Mercury: 1, Jupiter: 1, Venus: 1, Saturn: 1, Rahu: 1, Ketu: 1 } as const;

/* ─────────────────────────── small building blocks ─────────────────────────── */

export function DataRows({ rows }: { rows: readonly (readonly [string, ReactNode] | null | false)[] }) {
  return (
    <dl className="divide-y divide-line">
      {rows.filter((r): r is readonly [string, ReactNode] => Boolean(r)).map(([term, value]) => (
        <div key={term} className="grid gap-0.5 py-2.5 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <dt className="text-sm text-mist-300">{term}</dt>
          <dd className="min-w-0 text-[0.9375rem] break-words text-ivory-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function TableWrap({ caption, children, minWidth = "min-w-[40rem]" }: { caption: string; children: ReactNode; minWidth?: string }) {
  return (
    <div className="relative overflow-x-auto rounded-[0.9rem] border border-line" tabIndex={0} role="region" aria-label={caption}>
      <table className={`w-full ${minWidth} text-left text-sm`}>
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

const TH = "px-3 py-2.5 font-medium text-mist-200";
const TD = "px-3 py-2.5 align-top text-ivory-100";

function Unavailable({ children }: { children: ReactNode }) {
  return <p className="text-[0.9375rem] text-mist-300">{children}</p>;
}

function coverageReason(items: readonly CoverageItem[], id: string): string {
  const item = items.find((i) => i.id === id);
  return item?.reason ?? "Not calculated for this reading.";
}

function spanText(span: CurrentSpan, what: string): string {
  const entered = span.enteredLocal ? `began at ${span.enteredLocal}` : `began more than ${span.searchedHours} h earlier`;
  const leaves = span.leavesLocal ? `ends at ${span.leavesLocal}` : `lasts more than ${span.searchedHours} h longer`;
  return `The current ${what} ${entered} and ${leaves}.`;
}

function SegmentTable<T>({
  caption,
  segments,
  time,
  columns,
}: {
  caption: string;
  segments: readonly WindowSegment<T>[];
  time: TimeContext;
  columns: readonly { header: string; cell: (value: T) => ReactNode }[];
}) {
  return (
    <TableWrap caption={caption} minWidth="min-w-[30rem]">
      <thead className="bg-white/[0.04]">
        <tr>
          <th scope="col" className={TH}>
            Time range ({localZoneNote(time)})
          </th>
          {columns.map((c) => (
            <th key={c.header} scope="col" className={TH}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {segments.map((s) => (
          <tr key={s.fromUtc}>
            <td className={`${TD} font-mono text-[0.8125rem] whitespace-nowrap`}>{rangeLabel(s.fromLocal, s.toLocal)}</td>
            {columns.map((c) => (
              <td key={c.header} className={TD}>
                {c.cell(s.value)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}

/* ─────────────────────────────── sections ─────────────────────────────── */

export function TimeDetails({ time }: { time: TimeContext }) {
  const runtimeDiffers = time.runtimeTimeZone && time.timeZone && time.runtimeTimeZone !== time.timeZone;
  return (
    <DataRows
      rows={[
        ["Calculated for", BASIS_LABEL[time.basis]],
        ["Local date", time.localDate],
        ["Local time", time.localTime ?? "Not given"],
        [
          "Time zone",
          time.timeZone ? (
            <>
              {time.timeZone}
              {runtimeDiffers ? <span className="text-mist-300"> (runtime id {time.runtimeTimeZone})</span> : null}
            </>
          ) : (
            "Not given"
          ),
        ],
        ["UTC offset", time.utcOffset ?? "Not determined"],
        ["Birth instant (UTC)", utcLabel(time.birthUtc)],
        ["Daylight saving", DST_LABEL[time.dst]],
        [
          "Window considered",
          <>
            {utcLabel(time.windowStartUtc)} → {utcLabel(time.windowEndUtc)}
            <span className="mt-1 block text-sm text-mist-300">{time.windowReason}</span>
          </>,
        ],
        ["Julian Day (UT)", time.julianDayUT !== null ? <span className="font-mono">{String(time.julianDayUT)}</span> : "—"],
        ["Julian Day (TT)", time.julianDayTT !== null ? <span className="font-mono">{String(time.julianDayTT)}</span> : "—"],
        ["ΔT (TT − UT)", time.deltaTSeconds !== null ? `${time.deltaTSeconds.toFixed(2)} s` : "—"],
        ["Time-zone database", time.tzdbVersion ?? "Version not reported by the runtime"],
      ]}
    />
  );
}

export function EngineDetails({ engine }: { engine: EngineMetadata }) {
  return (
    <div className="flex flex-col gap-4">
      <DataRows
        rows={[
          ["Ephemeris engine", `${engine.providerName} ${engine.libraryVersion} (${engine.provider})`],
          ["Licence", engine.license],
          ["Ephemeris", engine.ephemeris],
          ["Ayanamsha", engine.ayanamshaImplementation],
          ["Ayanamsha at birth", <span key="a" className="font-mono">{formatDms(engine.ayanamshaDeg)}</span>],
          ["Tolerance source", engine.toleranceSource],
        ]}
      />
      {engine.engineFlags.length > 0 ? (
        <TableWrap caption="Engine flags per body" minWidth="min-w-[28rem]">
          <thead className="bg-white/[0.04]">
            <tr>
              <th scope="col" className={TH}>Body</th>
              <th scope="col" className={TH}>Returned flags</th>
              <th scope="col" className={TH}>Ephemeris used</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {engine.engineFlags.map((f) => (
              <tr key={f.body}>
                <td className={TD}>{f.body in GRAHA_KEYS ? grahaText(f.body as BodyId) : f.body}</td>
                <td className={`${TD} font-mono`}>{f.returnedFlags}</td>
                <td className={TD}>{f.ephemerisUsed}</td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : null}
    </div>
  );
}

export function PlanetTable({ bodies, time }: { bodies: readonly BodyResult[]; time: TimeContext }) {
  const withPlacement = bodies.filter((b) => b.atBirth !== null);
  const changing = bodies.filter((b) => b.atBirth === null || b.window.segments.length > 1);

  return (
    <div className="flex flex-col gap-5">
      {withPlacement.length > 0 ? (
        <TableWrap caption="Sidereal planetary positions at the stated birth instant">
          <thead className="bg-white/[0.04]">
            <tr>
              <th scope="col" className={TH}>Body</th>
              <th scope="col" className={TH}>Sign</th>
              <th scope="col" className={TH}>Degree in sign</th>
              <th scope="col" className={TH}>Nakshatra</th>
              <th scope="col" className={TH}>Pada</th>
              <th scope="col" className={TH}>Navamsa</th>
              <th scope="col" className={TH}>Motion</th>
              <th scope="col" className={TH}>Nearest Pada boundary</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {withPlacement.map((b) => {
              const p = b.atBirth!;
              return (
                <tr key={b.body}>
                  <th scope="row" className={`${TD} font-medium text-ivory-50`}>
                    <GrahaName body={b.body} />
                  </th>
                  <td className={TD}>
                    <SignName index={p.signIndex} />
                  </td>
                  <td className={`${TD} font-mono whitespace-nowrap`}>{formatDms(p.degreeInSign)}</td>
                  <td className={TD}>
                    {p.nakshatraName}{" "}
                    <span lang="sa" className="font-devanagari text-mist-300">
                      ({nakshatraDevanagari(p.nakshatraIndex)})
                    </span>
                  </td>
                  <td className={TD}>{p.pada}</td>
                  <td className={TD}>{signText(p.navamsaSignIndex)}</td>
                  <td className={TD}>
                    {p.retrograde === true ? (
                      <abbr title="Retrograde" className="font-semibold text-caution-200 no-underline">
                        <span aria-hidden="true">R</span>
                        <span className="sr-only">Retrograde</span>
                      </abbr>
                    ) : p.retrograde === false ? (
                      "Direct"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={TD}>
                    <span className="whitespace-nowrap">{formatArc(p.nearestPadaBoundaryArcsec)}</span>{" "}
                    <span className="text-mist-300">(tolerance {formatArc(b.toleranceArcsec)})</span>
                    {b.boundarySensitive ? (
                      <span className="mt-1 block">
                        <Badge tone="caution">Boundary-sensitive</Badge>
                      </span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      ) : (
        <Unavailable>
          No single birth instant was given, so positions are shown across the time window instead ({localZoneNote(time)}).
        </Unavailable>
      )}

      {changing.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h4 className="text-base font-semibold text-ivory-50">Changes within the birth-time window</h4>
          {changing.map((b) => (
            <div key={b.body} className="flex flex-col gap-2">
              <p className="text-sm text-mist-200">
                <span className="font-medium text-ivory-50">{grahaText(b.body)}</span>
                {b.window.padaStable ? " — same Pada throughout" : ` — ${b.window.segments.length} segments`}
                {b.transitionUncertaintyMinutes !== null
                  ? `; listed change times are uncertain by about ±${b.transitionUncertaintyMinutes} min`
                  : ""}
                {b.boundarySensitive ? " (boundary-sensitive)" : ""}
              </p>
              <SegmentTable
                caption={`${grahaText(b.body)}: Nakshatra Pada over the birth-time window`}
                segments={b.window.segments}
                time={time}
                columns={[
                  { header: "Nakshatra Pada", cell: (v) => `${v.nakshatraName} Pada ${v.pada}` },
                  { header: "Sign", cell: (v) => signText(v.signIndex) },
                ]}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HouseDetails({ chart }: { chart: ChartResult }) {
  const { ascendant, seventhHouse, time } = chart;
  const items = chart.coverage.items;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h4 className="text-base font-semibold text-ivory-50">Ascendant (Lagna)</h4>
        {ascendant ? (
          <>
            <DataRows
              rows={[
                ["Sign", <SignName key="s" index={ascendant.atBirth.signIndex} />],
                ["Degree in sign", <span key="d" className="font-mono">{formatDms(ascendant.atBirth.degreeInSign)}</span>],
                ["Nakshatra Pada", `${ascendant.atBirth.nakshatraName} Pada ${ascendant.atBirth.pada}`],
                ["Navamsa", signText(ascendant.atBirth.navamsaSignIndex)],
                [
                  "Nearest sign boundary",
                  <>
                    {formatArc(ascendant.atBirth.nearestSignBoundaryArcsec)}{" "}
                    <span className="text-mist-300">(tolerance {formatArc(ascendant.toleranceArcsec)})</span>
                    {ascendant.boundarySensitive ? (
                      <span className="ml-2">
                        <Badge tone="caution">Boundary-sensitive</Badge>
                      </span>
                    ) : null}
                  </>,
                ],
                ["Rising-sign span", spanText(ascendant.currentSignSpan, "rising sign")],
              ]}
            />
            {!ascendant.window.signStable ? (
              <SegmentTable
                caption="Ascendant sign over the birth-time window"
                segments={ascendant.window.segments}
                time={time}
                columns={[{ header: "Ascendant sign", cell: (v) => signText(v.signIndex) }]}
              />
            ) : null}
          </>
        ) : (
          <Unavailable>Not calculated: {coverageReason(items, "ascendant")}</Unavailable>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h4 className="text-base font-semibold text-ivory-50">Seventh house (whole sign)</h4>
        {seventhHouse ? (
          <>
            <DataRows
              rows={[
                ["Seventh sign", <SignName key="s" index={seventhHouse.atBirth.seventhSignIndex} />],
                ["Lord", <GrahaName key="l" body={seventhHouse.atBirth.lord} />],
                [
                  "Lord's Nakshatra Pada",
                  <>
                    {seventhHouse.atBirth.lordNakshatraName} Pada {seventhHouse.atBirth.lordPada}
                    {seventhHouse.lordBoundarySensitive ? (
                      <span className="ml-2">
                        <Badge tone="caution">Boundary-sensitive</Badge>
                      </span>
                    ) : null}
                  </>,
                ],
              ]}
            />
            {!seventhHouse.window.stable ? (
              <SegmentTable
                caption="Seventh house over the birth-time window"
                segments={seventhHouse.window.segments}
                time={time}
                columns={[
                  { header: "Seventh sign", cell: (v) => signText(v.seventhSignIndex) },
                  { header: "Lord", cell: (v) => grahaText(v.lord) },
                  { header: "Lord's Pada", cell: (v) => `${v.lordNakshatraName} Pada ${v.lordPada}` },
                ]}
              />
            ) : null}
          </>
        ) : (
          <Unavailable>Not calculated: {coverageReason(items, "seventh_house_lord")}</Unavailable>
        )}
      </div>
    </div>
  );
}

export function KarakaDetails({ chart }: { chart: ChartResult }) {
  const ck = chart.charaKarakas;
  return (
    <div className="flex flex-col gap-4">
      <DataRows
        rows={[
          ["Scheme", KARAKA_SCHEME_LABEL[ck.scheme]],
          ["Lunar node", NODE_LABEL[ck.nodeType]],
          ["Rahu", ck.rahuHandling === "excluded" ? "Excluded" : "Ranked at 30° − its degree in sign"],
          ["Tie tolerance", formatArc(ck.tieToleranceArcsec)],
        ]}
      />
      {ck.atBirth ? (
        <>
          <TableWrap caption="Chara Karaka order at the stated birth instant" minWidth="min-w-[24rem]">
            <thead className="bg-white/[0.04]">
              <tr>
                <th scope="col" className={TH}>Karaka</th>
                <th scope="col" className={TH}>Body</th>
                <th scope="col" className={TH}>Ranking degree</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {ck.atBirth.order.map((k) => (
                <tr key={k.karaka}>
                  <th scope="row" className={`${TD} font-medium text-ivory-50`}>
                    {k.karaka} <span className="text-mist-300">({k.abbreviation})</span>
                  </th>
                  <td className={TD}>
                    <GrahaName body={k.body} />
                  </td>
                  <td className={`${TD} font-mono`}>{formatDms(k.rankingDegree)}</td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <DataRows
            rows={[
              [
                "Darakaraka",
                `${grahaText(ck.atBirth.darakaraka.body)} — ${ck.atBirth.darakaraka.nakshatraName} Pada ${ck.atBirth.darakaraka.pada}`,
              ],
              [
                "Gap between the two lowest",
                <>
                  {formatArc(ck.atBirth.lowestGapArcsec)}
                  {ck.atBirth.tie ? (
                    <span className="ml-2">
                      <Badge tone="caution">Tie within tolerance</Badge>
                    </span>
                  ) : null}
                </>,
              ],
            ]}
          />
        </>
      ) : (
        <Unavailable>No single birth instant was given, so the Darakaraka is shown for each part of the window.</Unavailable>
      )}
      {!ck.window.stable || !ck.atBirth ? (
        <SegmentTable
          caption="Darakaraka over the birth-time window"
          segments={ck.window.segments}
          time={chart.time}
          columns={[
            { header: "Darakaraka", cell: (v) => grahaText(v.body) },
            { header: "Nakshatra Pada", cell: (v) => `${v.nakshatraName} Pada ${v.pada}` },
            { header: "Tie", cell: (v) => (v.tie ? "Yes" : "No") },
          ]}
        />
      ) : null}
    </div>
  );
}

export function CoverageList({ items }: { items: readonly CoverageItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <li key={item.id} className="flex items-start gap-2.5">
          {item.available ? (
            <CheckIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-status-verified" />
          ) : (
            <CloseIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-mist-400" />
          )}
          <span className="text-[0.9375rem] text-ivory-100">
            {item.label}
            <span className="sr-only">: {item.available ? "available" : "not available"}</span>
            {!item.available && item.reason ? <span className="block text-sm text-mist-300">{item.reason}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Full calculation breakdown, each part in its own disclosure. */
export function CalculationBreakdown({ chart }: { chart: ChartResult }) {
  return (
    <section aria-labelledby="breakdown-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 id="breakdown-heading" className="font-display text-3xl text-ivory-50">
          How this was calculated
        </h2>
        <p className="max-w-prose text-[0.9375rem] text-mist-300">
          Every value below comes from the calculation service. Angles are sidereal (Lahiri); placements within the
          measured engine tolerance of a boundary are flagged rather than rounded.
        </p>
      </div>
      <Disclosure title="Birth time conversion" headingLevel={3} region={false}>
        <TimeDetails time={chart.time} />
      </Disclosure>
      <Disclosure title="Calculation engine" headingLevel={3} region={false}>
        <EngineDetails engine={chart.engine} />
      </Disclosure>
      <Disclosure title="Planetary positions" headingLevel={3} region={false} defaultOpen>
        <PlanetTable bodies={chart.bodies} time={chart.time} />
      </Disclosure>
      <Disclosure title="Ascendant and seventh house" headingLevel={3} region={false}>
        <HouseDetails chart={chart} />
      </Disclosure>
      <Disclosure title="Chara Karakas" headingLevel={3} region={false}>
        <KarakaDetails chart={chart} />
      </Disclosure>
      <Disclosure title="Coverage" headingLevel={3} region={false}>
        <CoverageList items={chart.coverage.items} />
      </Disclosure>
    </section>
  );
}
