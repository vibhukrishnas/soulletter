"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useSyncExternalStore } from "react";
import { Container } from "@/components/layout/Container";
import { SectionHeading } from "@/components/layout/SectionHeading";
import { Button, Callout, Card, Input, Label, Spinner } from "@/components/ui";
import { formatDms } from "@/lib/astro/angles";
import { RASHI_NAMES, nakshatraDevanagari } from "@/lib/astro/names";
import { isValidIanaTimeZone, parseClockTime, parseIsoDate } from "@/lib/astro/time";
import { INITIAL_VALUES, saveProgress, todayIso } from "@/lib/client/onboarding";
import { useChartPreview } from "@/lib/client/preview";
import type { BirthInput } from "@/lib/contracts/input";
import { birthInputSchema } from "@/lib/contracts/input";
import type { PreviewBody } from "@/lib/contracts/preview";

function Rashi({ index }: { index: number }) {
  const n = RASHI_NAMES[index];
  return (
    <>
      {n.sanskrit}{" "}
      <span lang="sa" className="font-devanagari">
        {n.devanagari}
      </span>{" "}
      <span className="text-mist-300">· {n.english}</span>
    </>
  );
}

function BodyValue({ body }: { body: PreviewBody | undefined }) {
  if (!body) return null;
  if (body.atBirth) {
    const p = body.atBirth;
    return (
      <>
        <Rashi index={p.signIndex} />
        <span className="block text-sm text-mist-300">
          {p.nakshatraName}{" "}
          <span lang="sa" className="font-devanagari">
            {nakshatraDevanagari(p.nakshatraIndex)}
          </span>{" "}
          · Pada {p.pada} · {formatDms(p.degreeInSign, 0)} in sign
          {p.boundarySensitive ? " · close to a boundary" : ""}
        </span>
      </>
    );
  }
  return (
    <ul className="mt-1 space-y-1 text-sm text-mist-300">
      {body.spans.map((s) => (
        <li key={`${s.fromLocal}-${s.toLocal}`}>
          <span className="text-ivory-100">
            <Rashi index={s.signIndex} />
          </span>{" "}
          · {s.nakshatraName} Pada {s.pada}{" "}
          <span className="whitespace-nowrap text-mist-400">
            ({s.fromLocal.slice(11)} → {s.toLocal.slice(11)})
          </span>
        </li>
      ))}
    </ul>
  );
}

const NO_ZONES: string[] = [];
let zoneCache: string[] | null = null;
function clientZones(): string[] {
  if (zoneCache === null) {
    try {
      zoneCache = Intl.supportedValuesOf("timeZone");
    } catch {
      zoneCache = NO_ZONES;
    }
  }
  return zoneCache;
}
function deviceZoneSnapshot(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
const noSubscribe = () => () => {};

/**
 * Landing-page quick look: the visitor's own Moon and Sun Rashi and Janma Nakshatra from
 * the calculation service, live as they type. Nothing is shown until it is calculated.
 */
export function QuickLook() {
  const router = useRouter();
  const ids = { date: useId(), time: useId(), zone: useId(), zones: useId() };
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [zone, setZone] = useState("");
  // Client-only values read without effects; the server snapshot keeps hydration stable.
  const zones = useSyncExternalStore(noSubscribe, clientZones, () => NO_ZONES);
  const deviceZone = useSyncExternalStore(noSubscribe, deviceZoneSnapshot, () => null);

  const birth: BirthInput | null = useMemo(() => {
    if (!parseIsoDate(date) || date > todayIso()) return null;
    const known = time !== "" && parseClockTime(time) !== null;
    const tz = zone.trim() && isValidIanaTimeZone(zone.trim()) ? zone.trim() : null;
    const candidate: BirthInput = {
      birthDate: date,
      birthTimeKnown: known,
      birthTime: known ? time : null,
      birthTimeAccuracy: known ? "to_the_minute" : null,
      dstChoice: null,
      place: { label: null, latitude: null, longitude: null, timeZone: tz },
    };
    return birthInputSchema.safeParse(candidate).success ? candidate : null;
  }, [date, time, zone]);

  const state = useChartPreview(birth);
  const preview = state.status === "ready" ? state.preview : state.status !== "idle" ? state.previous : null;
  const body = (name: string) => preview?.bodies.find((b) => b.body === name);
  const zoneInvalid = zone.trim() !== "" && !isValidIanaTimeZone(zone.trim());

  function continueToReading() {
    const known = time !== "" && parseClockTime(time) !== null;
    const tz = zone.trim() && isValidIanaTimeZone(zone.trim()) ? zone.trim() : "";
    saveProgress(
      {
        ...INITIAL_VALUES,
        birthDate: date,
        birthTimeKnown: known ? true : null,
        birthTime: known ? time : "",
        placeMode: tz ? "time_zone_only" : null,
        timeZone: tz,
      },
      "profile",
    );
    router.push("/discover");
  }

  return (
    <section id="quick-look" aria-labelledby="quick-look-title" className="py-16 sm:py-20">
      <Container size="md">
        <SectionHeading
          id="quick-look-title"
          eyebrow="Quick look"
          title="See your own Rashi and Nakshatra"
          description="Enter a date of birth — add the time and time zone for exact values. Everything below is calculated for you; nothing is a sample."
          align="center"
        />
        <Card className="mt-8" padding="lg">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.date} required>
                Date of birth
              </Label>
              <Input id={ids.date} type="date" value={date} max={todayIso()} min="1800-01-01" onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.time} optional>
                Birth time (24-hour)
              </Label>
              <Input id={ids.time} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ids.zone} optional>
                Time zone
              </Label>
              <Input
                id={ids.zone}
                list={ids.zones}
                placeholder="e.g. Asia/Kolkata"
                value={zone}
                invalid={zoneInvalid}
                aria-describedby={zoneInvalid ? `${ids.zone}-err` : undefined}
                onChange={(e) => setZone(e.target.value)}
                autoComplete="off"
              />
              <datalist id={ids.zones}>
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
              {zoneInvalid ? (
                <p id={`${ids.zone}-err`} className="text-sm text-important-200">
                  Use a time-zone name such as Asia/Kolkata.
                </p>
              ) : deviceZone && zone === "" ? (
                <button type="button" className="self-start text-sm text-gold-300 underline underline-offset-4" onClick={() => setZone(deviceZone)}>
                  Use this device&apos;s zone ({deviceZone})
                </button>
              ) : null}
            </div>
          </div>

          <div aria-live="polite" className="mt-6">
            {state.status === "idle" ? (
              <p className="text-sm text-mist-400">Your Moon sign, Janma Nakshatra and Sun sign will appear here.</p>
            ) : null}
            {state.status === "loading" && !preview ? <Spinner label="Calculating your placements…" labelVisible /> : null}
            {state.status === "error" ? <Callout tone="caution">{state.error.message}</Callout> : null}
            {preview ? (
              <div className={state.status === "loading" ? "opacity-60 transition-opacity" : undefined}>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-sm text-mist-400">Moon sign (Chandra Rashi) · Janma Nakshatra</dt>
                    <dd className="mt-1 text-lg text-ivory-50">
                      <BodyValue body={body("Moon")} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm text-mist-400">Sun sign (Surya Rashi)</dt>
                    <dd className="mt-1 text-lg text-ivory-50">
                      <BodyValue body={body("Sun")} />
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm text-mist-400">
                  Sidereal zodiac, Lahiri ayanamsha {formatDms(preview.ayanamshaDeg, 0)} for this date.{" "}
                  {preview.basis === "exact_instant"
                    ? "Add your birthplace in the full reading to calculate your Lagna (Ascendant) and houses."
                    : preview.basis === "local_day"
                      ? "Without a birth time, the Moon is shown for each part of the day."
                      : "Without a time zone, every possible offset is considered, so ranges are wide."}
                </p>
                <div className="mt-5">
                  <Button variant="primary" onClick={continueToReading}>
                    Continue to your full reading
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </Container>
    </section>
  );
}
