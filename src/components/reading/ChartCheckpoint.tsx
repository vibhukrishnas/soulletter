"use client";

import { Badge, Button, Callout, Card, SparkleIcon } from "@/components/ui";
import { formatArc, formatDms } from "@/lib/astro/angles";
import type { ReadingResult } from "@/lib/contracts/reading";
import { PHASE_HEADING_ID } from "@/components/onboarding/field-ids";
import { COVERAGE_LABEL, COVERAGE_TONE, localZoneNote, rangeLabel } from "./format";
import { NakshatraName, SignName } from "./VedicNames";

export interface ChartCheckpointProps {
  result: ReadingResult;
  onReveal: () => void;
  onEdit: () => void;
}

/** "Your calculated chart": the inputs to the reading, checked before anything is revealed. */
export function ChartCheckpoint({ result, onReveal, onEdit }: ChartCheckpointProps) {
  const { chart } = result;
  const moon = chart.bodies.find((b) => b.body === "Moon");
  const asc = chart.ascendant;
  const ascReason = chart.coverage.items.find((i) => i.id === "ascendant")?.reason;
  const important = result.warnings.filter((w) => w.severity === "important");

  return (
    <section aria-labelledby={PHASE_HEADING_ID} className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h1
          id={PHASE_HEADING_ID}
          tabIndex={-1}
          className="font-display text-4xl leading-tight text-ivory-50 focus:outline-none sm:text-5xl"
        >
          Your calculated chart
        </h1>
        <p className="text-base text-mist-300">
          These are the calculated positions your reading is based on. Check they match what you expected, then reveal
          the reading.
        </p>
        <div>
          <Badge tone={COVERAGE_TONE[result.coverage.level]} size="md">
            {COVERAGE_LABEL[result.coverage.level]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card as="article" aria-labelledby="checkpoint-moon">
          <h2 id="checkpoint-moon" className="font-display text-2xl text-ivory-50">
            {moon?.atBirth ? "Moon sign (Chandra Rashi) at birth" : "Moon on your birth date"}
          </h2>
          {moon?.atBirth ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-lg text-ivory-50" data-testid="checkpoint-moon-sign">
                <SignName index={moon.atBirth.signIndex} />{" "}
                <span className="font-mono text-base">{formatDms(moon.atBirth.degreeInSign)}</span>
              </p>
              <p className="text-[0.9375rem] text-mist-300">
                Janma Nakshatra:{" "}
                <span className="text-ivory-100">
                  <NakshatraName index={moon.atBirth.nakshatraIndex} name={moon.atBirth.nakshatraName} pada={moon.atBirth.pada} />
                </span>
              </p>
              {moon.boundarySensitive ? (
                <p className="text-sm text-caution-200">
                  Within {formatArc(moon.toleranceArcsec)} engine tolerance of a Pada boundary (
                  {formatArc(moon.atBirth.nearestPadaBoundaryArcsec)} away).
                </p>
              ) : null}
            </div>
          ) : null}
          {moon && (moon.atBirth === null || !moon.window.padaStable) ? (
            <div className="mt-4 flex flex-col gap-2">
              <p className="text-sm text-mist-300">
                {moon.atBirth === null
                  ? "Your birth time is unknown, so the Moon's Pada is shown for each part of the birth date"
                  : "The Moon changes Pada within your birth-time margin"}{" "}
                ({localZoneNote(chart.time)}):
              </p>
              <ul className="flex flex-col gap-1.5">
                {moon.window.segments.map((s) => (
                  <li key={s.fromUtc} className="flex flex-col text-[0.9375rem] sm:flex-row sm:gap-3">
                    <span className="font-mono text-sm text-mist-200">{rangeLabel(s.fromLocal, s.toLocal)}</span>
                    <span className="text-ivory-100">
                      <NakshatraName index={s.value.nakshatraIndex} name={s.value.nakshatraName} pada={s.value.pada} /> ·{" "}
                      <SignName index={s.value.signIndex} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {!moon ? <p className="mt-3 text-mist-300">The Moon&apos;s position was not returned.</p> : null}
        </Card>

        <Card as="article" aria-labelledby="checkpoint-asc">
          <h2 id="checkpoint-asc" className="font-display text-2xl text-ivory-50">
            Ascendant (Lagna)
          </h2>
          {asc ? (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-lg text-ivory-50" data-testid="checkpoint-lagna">
                <SignName index={asc.atBirth.signIndex} />
              </p>
              <p className="text-[0.9375rem] text-mist-300">
                <span className="font-mono">{formatDms(asc.atBirth.degreeInSign)}</span> · {asc.atBirth.nakshatraName}{" "}
                Pada {asc.atBirth.pada}
              </p>
              {asc.boundarySensitive ? (
                <p className="text-sm text-caution-200">Within engine tolerance of a sign boundary.</p>
              ) : null}
              {!asc.window.signStable ? (
                <div className="mt-2 flex flex-col gap-1.5">
                  <p className="text-sm text-mist-300">
                    The rising sign changes within your birth-time margin ({localZoneNote(chart.time)}):
                  </p>
                  <ul className="flex flex-col gap-1">
                    {asc.window.segments.map((s) => (
                      <li key={s.fromUtc} className="flex flex-col text-[0.9375rem] sm:flex-row sm:gap-3">
                        <span className="font-mono text-sm text-mist-200">{rangeLabel(s.fromLocal, s.toLocal)}</span>
                        <span className="text-ivory-100">
                          <SignName index={s.value.signIndex} />
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[0.9375rem] text-mist-300">
              Not calculated{ascReason ? `: ${ascReason}` : "."}
            </p>
          )}
        </Card>
      </div>

      {important.length > 0 ? (
        <div className="flex flex-col gap-3">
          {important.map((w, i) => (
            <Callout
              key={`${w.code}-${i}`}
              tone="important"
              title={w.subject ? `Important — ${w.subject}` : "Important"}
            >
              {w.message}
            </Callout>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onReveal} leadingIcon={<SparkleIcon />} data-testid="checkpoint-reveal">
          Reveal my reading
        </Button>
        <Button size="lg" variant="secondary" onClick={onEdit}>
          Edit details
        </Button>
      </div>
    </section>
  );
}
