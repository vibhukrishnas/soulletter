"use client";

import type { ReactNode } from "react";
import { Callout, Spinner } from "@/components/ui";
import { formatDms } from "@/lib/astro/angles";
import type { BodyId } from "@/lib/astro/zodiac";
import type { PreviewState } from "@/lib/client/preview";
import type { ChartPreview, KarakaOption, NodeOption, PreviewPlacement } from "@/lib/contracts/preview";
import { GrahaName, NakshatraName, SignName } from "@/components/reading/VedicNames";

export { GrahaName, NakshatraName, SignName };

function degree(p: PreviewPlacement) {
  return formatDms(p.degreeInSign, 0);
}

function BoundaryNote({ show }: { show: boolean }) {
  return show ? <span className="block text-xs text-caution-200">Close to a boundary — the next one along is also possible.</span> : null;
}

/** Placement of a body at birth, or its spans across the possible birth times. */
export function BodyPlacement({ preview, body }: { preview: ChartPreview; body: BodyId }) {
  const b = preview.bodies.find((x) => x.body === body);
  if (!b) return null;
  if (b.atBirth) {
    return (
      <span>
        <SignName index={b.atBirth.signIndex} /> {degree(b.atBirth)}
        <span className="block text-sm text-mist-300">
          <NakshatraName index={b.atBirth.nakshatraIndex} name={b.atBirth.nakshatraName} pada={b.atBirth.pada} />
          {b.retrograde && body !== "Rahu" && body !== "Ketu" ? " · retrograde" : ""}
        </span>
        <BoundaryNote show={b.atBirth.boundarySensitive} />
      </span>
    );
  }
  const stable = new Set(b.spans.map((s) => s.signIndex)).size === 1;
  return (
    <span>
      {stable ? (
        <>
          <SignName index={b.spans[0].signIndex} /> <span className="text-sm text-mist-400">(all day)</span>
        </>
      ) : (
        <span className="text-mist-300">Depends on the birth time:</span>
      )}
      <ul className="mt-1 space-y-0.5 text-sm text-mist-300">
        {b.spans.map((s) => (
          <li key={`${s.fromLocal}-${s.toLocal}`}>
            {stable ? null : (
              <>
                <SignName index={s.signIndex} english={false} />{" "}
              </>
            )}
            <NakshatraName index={s.nakshatraIndex} name={s.nakshatraName} pada={s.pada} />{" "}
            <span className="whitespace-nowrap text-mist-400">
              {s.fromLocal.slice(11)}–{s.toLocal.slice(11)}
            </span>
          </li>
        ))}
      </ul>
    </span>
  );
}

function PreviewFrame({ state, children }: { state: PreviewState; children: (p: ChartPreview) => ReactNode }) {
  const preview = state.status === "ready" ? state.preview : state.status === "idle" ? null : state.previous;
  return (
    <div aria-live="polite" aria-busy={state.status === "loading"}>
      {state.status === "idle" ? (
        <p className="text-sm text-mist-300">
          Enter your date of birth and answer the birth-time question to see your own placements here.
        </p>
      ) : null}
      {state.status === "loading" && !preview ? <Spinner label="Calculating your placements…" labelVisible /> : null}
      {state.status === "error" ? (
        <Callout tone="caution" className="mb-3">
          {state.error.message}
        </Callout>
      ) : null}
      {preview ? <div className={state.status === "loading" ? "opacity-60 transition-opacity" : undefined}>{children(preview)}</div> : null}
    </div>
  );
}

function Row({ term, rule, children, testId }: { term: string; rule?: string; children: ReactNode; testId?: string }) {
  return (
    <div className="rounded-card border border-line bg-night-800/50 p-4" data-testid={testId}>
      <dt className="text-sm text-mist-300">{term}</dt>
      <dd className="mt-1 text-ivory-50">{children}</dd>
      {rule ? <dd className="mt-2 text-xs leading-relaxed text-mist-400">{rule}</dd> : null}
    </div>
  );
}

function lagnaReason(preview: ChartPreview): string {
  return preview.lagna.reason ?? "Not available for these details.";
}

/** Compact live summary (step 2 and the review step). */
export function LiveChartSummary({ state, title = "Your chart so far" }: { state: PreviewState; title?: string }) {
  return (
    <section aria-labelledby="live-chart-summary" className="rounded-panel border border-gold-300/20 bg-indigo-950/40 p-4 sm:p-5" data-testid="live-chart-summary">
      <h3 id="live-chart-summary" className="font-display text-2xl text-ivory-50">
        {title}
      </h3>
      <p className="mt-1 text-sm text-mist-300">Calculated live from the details you entered — updates as you change them.</p>
      <div className="mt-4">
        <PreviewFrame state={state}>
          {(p) => (
            <dl className="grid gap-3 sm:grid-cols-2">
              <Row term="Moon sign (Chandra Rashi) · Janma Nakshatra" testId="live-moon">
                <BodyPlacement preview={p} body="Moon" />
              </Row>
              <Row term="Sun sign (Surya Rashi)">
                <BodyPlacement preview={p} body="Sun" />
              </Row>
              <Row term="Ascendant (Lagna)" testId="live-lagna">
                {p.lagna.atBirth ? (
                  <span>
                    <SignName index={p.lagna.atBirth.signIndex} /> {degree(p.lagna.atBirth)}
                    <BoundaryNote show={p.lagna.atBirth.boundarySensitive} />
                  </span>
                ) : (
                  <span className="text-mist-300">{lagnaReason(p)}</span>
                )}
              </Row>
              <Row term="7th house and its lord">
                {p.seventhHouse ? (
                  <span>
                    <SignName index={p.seventhHouse.signIndex} /> — lord <GrahaName body={p.seventhHouse.lord} />
                  </span>
                ) : (
                  <span className="text-mist-300">Needs the Ascendant.</span>
                )}
              </Row>
            </dl>
          )}
        </PreviewFrame>
      </div>
    </section>
  );
}

/** Replaces the old static "fixed conventions": every convention with the user's own result. */
export function ConventionsPanel({ state }: { state: PreviewState }) {
  return (
    <section aria-labelledby="ob-conventions-heading" className="flex flex-col gap-4" data-testid="conventions-panel">
      <h3 id="ob-conventions-heading" className="font-display text-2xl text-ivory-50">
        Your chart with these settings
      </h3>
      <p className="text-sm text-mist-300">
        Each convention below is shown with what it calculates for you. Values update as you change your details or options.
      </p>
      <PreviewFrame state={state}>
        {(p) => (
          <dl className="grid gap-3 sm:grid-cols-2">
            <Row
              term="Sidereal zodiac · Lahiri (Chitrapaksha) ayanamsha"
              rule={`Lahiri ayanamsha on your birth date: ${formatDms(p.ayanamshaDeg, 0)}. Positions are measured against the fixed stars, as in Jyotisha.`}
              testId="convention-zodiac"
            >
              <span className="text-sm text-mist-300">Your Moon sign (Chandra Rashi)</span>
              <span className="block">
                <BodyPlacement preview={p} body="Moon" />
              </span>
            </Row>
            <Row term="Sun sign (Surya Rashi)" rule="The Sun's sidereal sign — usually different from a Western (tropical) Sun sign.">
              <BodyPlacement preview={p} body="Sun" />
            </Row>
            <Row
              term="D1 / Rashi chart · Ascendant (Lagna)"
              rule="The main birth chart, anchored by the sign rising in the east at birth."
              testId="convention-lagna"
            >
              {p.lagna.atBirth ? (
                <span>
                  <SignName index={p.lagna.atBirth.signIndex} /> {degree(p.lagna.atBirth)}
                  <span className="block text-sm text-mist-300">
                    Navamsa (D9): <SignName index={p.lagna.atBirth.navamsaSignIndex} />
                  </span>
                  <BoundaryNote show={p.lagna.atBirth.boundarySensitive} />
                  {!p.lagna.signStable ? (
                    <span className="block text-xs text-caution-200">Changes sign within your birth-time accuracy window.</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-mist-300">{lagnaReason(p)}</span>
              )}
            </Row>
            <Row
              term="Whole-sign houses · 7th house"
              rule="Each sign is one house, counted from the Lagna; the 7th house is the sign opposite it."
              testId="convention-houses"
            >
              {p.seventhHouse ? (
                <span>
                  <SignName index={p.seventhHouse.signIndex} />
                  <span className="block text-sm text-mist-300">
                    Lord: <GrahaName body={p.seventhHouse.lord} />, in{" "}
                    <SignName index={p.seventhHouse.lordAtBirth.signIndex} english={false} /> ·{" "}
                    <NakshatraName
                      index={p.seventhHouse.lordAtBirth.nakshatraIndex}
                      name={p.seventhHouse.lordAtBirth.nakshatraName}
                      pada={p.seventhHouse.lordAtBirth.pada}
                    />
                  </span>
                </span>
              ) : (
                <span className="text-mist-300">Needs the Ascendant ({lagnaReason(p).toLowerCase()})</span>
              )}
            </Row>
          </dl>
        )}
      </PreviewFrame>
    </section>
  );
}

/** "→ Rahu in Makara 9°30′, Uttara Ashadha Pada 4" for a node option. */
export function NodeOptionResult({ state, node }: { state: PreviewState; node: NodeOption }) {
  const p = state.status === "ready" ? state.preview : null;
  const r = p?.rahu[node];
  if (!r) return null;
  return (
    <span className="mt-1 block text-ivory-100" data-testid={`node-result-${node}`}>
      Rahu in <SignName index={r.signIndex} english={false} /> {degree(r)} · {r.nakshatraName} Pada {r.pada}
    </span>
  );
}

/** "→ Darakaraka: Guru (Jupiter), Pushya Pada 4" for a Chara Karaka option. */
export function KarakaOptionResult({ state, scheme, node }: { state: PreviewState; scheme: KarakaOption; node: NodeOption }) {
  const p = state.status === "ready" ? state.preview : null;
  if (!p) return null;
  const dk = p.darakaraka[scheme][node];
  if (!dk) {
    return p.basis === "exact_instant" ? null : (
      <span className="mt-1 block text-mist-300">Your Darakaraka depends on the birth time.</span>
    );
  }
  return (
    <span className="mt-1 block text-ivory-100" data-testid={`karaka-result-${scheme}`}>
      Darakaraka: <GrahaName body={dk.body} />, {dk.nakshatraName} Pada {dk.pada}
      {dk.tie ? <span className="block text-xs text-caution-200">Tied with another planet — not determinable.</span> : null}
      {dk.boundarySensitive ? (
        <span className="block text-xs text-caution-200">Close to a Pada boundary — the neighbouring Pada is also possible.</span>
      ) : null}
    </span>
  );
}
