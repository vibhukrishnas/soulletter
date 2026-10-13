import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Badge, Callout, Card, CardBody, CardHeader, CardTitle, StatusBadge } from "@/components/ui";
import { AVAKAHADA_ENTRIES, AVAKAHADA_SOURCES, AVAKAHADA_TABLE } from "@/lib/avakahada/table";
import { NAKSHATRAS } from "@/lib/astro/zodiac";
import { ORDERING_POLICY } from "@/lib/reading/candidates";
import { CALCULATION_COMPONENTS, RULES, RULE_SET_VERSION } from "@/lib/rules/registry";
import { MEASURED_AGREEMENT } from "@/server/ephemeris/engine-tolerances";
import { READING_DISCLAIMER, READING_LIMITATIONS, READING_SOURCES } from "@/server/reading/pipeline";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "How SoulLetter calculates sidereal charts, which interpretation rules it uses, how they are labelled, and what is not scientifically validated.",
};

const INPUT_LABEL: Record<string, string> = {
  birth_date: "Birth date",
  time_zone: "Time zone",
  birth_time: "Birth time",
  coordinates: "Birthplace coordinates",
  name: "Name",
};

export default function MethodologyPage() {
  const active = RULES.filter((r) => r.enabled);
  const excluded = RULES.filter((r) => !r.enabled);
  const tableBands = MEASURED_AGREEMENT.bands;
  const keys = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Jupiter", "Saturn", "MeanNode", "TrueNode", "Ascendant"] as const;

  return (
    <Container size="md" className="py-12 sm:py-16">
      <header className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-gold-300">Methodology</p>
        <h1 className="mt-3 font-display text-4xl text-ivory-50 sm:text-5xl">How SoulLetter works</h1>
        <p className="mt-4 text-lg text-mist-300">
          SoulLetter calculates first and interprets second. Astronomical positions are calculated with documented
          conventions and checked against independent references. Interpretations are labelled by how well they are
          supported — and the partner-syllable readings are explicitly experimental.
        </p>
      </header>

      <Callout tone="important" title="What this is — and is not" className="mt-8">
        {READING_DISCLAIMER}
      </Callout>

      <section aria-labelledby="calc" className="mt-14">
        <h2 id="calc" className="font-display text-3xl text-ivory-50">1. What is calculated</h2>
        <div className="mt-6 grid gap-4">
          {CALCULATION_COMPONENTS.map((c) => (
            <Card key={c.id} as="article">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{c.name}</CardTitle>
                <StatusBadge status={c.verificationStatus} />
              </CardHeader>
              <CardBody className="space-y-2 text-mist-300">
                <p>{c.procedure}</p>
                <p className="text-sm text-mist-400">
                  <span className="font-medium text-mist-200">Verification: </span>
                  {c.verification}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="engine" className="mt-14">
        <h2 id="engine" className="font-display text-3xl text-ivory-50">2. Engine agreement (measured)</h2>
        <p className="mt-3 text-mist-300">
          Production positions come from astronomy-engine 2.1.19 (MIT). They were compared with Swiss Ephemeris
          ({MEASURED_AGREEMENT.referenceEngine}, official data files) at {MEASURED_AGREEMENT.samplesPerBand.toLocaleString("en")}{" "}
          instants per date range. A placement closer than the tolerance below to a boundary is flagged as
          boundary-sensitive and both neighbouring results are shown.
        </p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="sr-only">Boundary-sensitivity tolerances in arcseconds by date range</caption>
            <thead className="bg-white/[0.04] text-mist-200">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Quantity</th>
                {tableBands.map((b) => (
                  <th key={b.id} scope="col" className="px-3 py-2 font-medium">{b.id}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-mist-300">
              {keys.map((k) => (
                <tr key={k} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-normal text-ivory-100">{k === "MeanNode" ? "Mean node" : k === "TrueNode" ? "True node" : k}</th>
                  {tableBands.map((b) => (
                    <td key={b.id} className="px-3 py-2 tabular-nums">{b.toleranceArcsec[k]}″</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-mist-400">{MEASURED_AGREEMENT.method}</p>
      </section>

      <section aria-labelledby="rules" className="mt-14">
        <h2 id="rules" className="font-display text-3xl text-ivory-50">3. Interpretation rules in use</h2>
        <p className="mt-3 text-mist-300">Rule set {RULE_SET_VERSION}. {ORDERING_POLICY}</p>
        <div className="mt-6 grid gap-4">
          {active.map((r) => (
            <Card key={r.id} as="article">
              <CardHeader className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>{r.name}</CardTitle>
                <StatusBadge status={r.verificationStatus} />
              </CardHeader>
              <CardBody className="space-y-3 text-mist-300">
                <p className="text-sm text-mist-400">{r.tradition} · v{r.version}</p>
                <p>{r.calculationProcedure}</p>
                <p className="text-sm">
                  <span className="font-medium text-mist-200">Needs: </span>
                  {r.inputRequirements.map((i) => INPUT_LABEL[i] ?? i).join(", ")}
                </p>
                <p className="text-sm">
                  <span className="font-medium text-mist-200">Source: </span>
                  {r.source}
                  {r.sourceUrl ? (
                    <>
                      {" "}
                      <a href={r.sourceUrl} className="text-gold-300 underline underline-offset-4 hover:text-gold-200" rel="noreferrer noopener" target="_blank">
                        (link)
                      </a>
                    </>
                  ) : null}
                </p>
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {r.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="excluded" className="mt-14">
        <h2 id="excluded" className="font-display text-3xl text-ivory-50">4. Methods we deliberately do not use</h2>
        <p className="mt-3 text-mist-300">
          These appear in research drafts or online, but the evidence is insufficient. They are registered as disabled
          so they can never produce a result.
        </p>
        <ul className="mt-6 grid gap-3">
          {excluded.map((r) => (
            <li key={r.id} className="rounded-xl border border-line bg-white/[0.02] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-ivory-100">{r.name}</p>
                <StatusBadge status={r.verificationStatus} />
              </div>
              <p className="mt-2 text-sm text-mist-300">{r.limitations[0]}</p>
              <p className="mt-1 text-xs text-mist-400">Audit reference: {r.auditRefs.join(", ")}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="table" className="mt-14">
        <h2 id="table" className="font-display text-3xl text-ivory-50">5. The Avakahada naming-syllable table</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status="provisional_source" />
          <Badge tone="neutral">{AVAKAHADA_TABLE.version}</Badge>
        </div>
        <p className="mt-3 text-mist-300">
          {AVAKAHADA_TABLE.title}. Selected variant: {AVAKAHADA_TABLE.selectedVariant}. Rare syllables are always shown as
          published, never replaced. Cells marked † have a recorded variant.
        </p>
        <div className="mt-5 overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">Nakshatra Pada naming syllables</caption>
            <thead className="bg-white/[0.04] text-mist-200">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Nakshatra</th>
                {[1, 2, 3, 4].map((p) => (
                  <th key={p} scope="col" className="px-3 py-2 font-medium">Pada {p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAKSHATRAS.map((n) => (
                <tr key={n.index} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 font-normal text-ivory-100">
                    {n.index + 1}. {n.name}
                  </th>
                  {AVAKAHADA_ENTRIES.filter((e) => e.nakshatraIndex === n.index).map((e) => (
                    <td key={e.cellId} className="px-3 py-2 text-mist-300" title={e.variantNote ?? undefined}>
                      <span lang="sa" className="font-devanagari text-base text-ivory-50">{e.devanagari}</span>{" "}
                      {e.roman}
                      {e.variantNote ? <span aria-label="has a recorded variant" className="text-gold-300"> †</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 space-y-1 text-sm text-mist-400">
          {AVAKAHADA_SOURCES.map((s) => (
            <li key={s.id}>
              <span className="font-medium text-mist-200">{s.id}</span>{" "}
              <a href={s.url} className="text-gold-300 underline underline-offset-4 hover:text-gold-200" rel="noreferrer noopener" target="_blank">
                {s.label}
              </a>{" "}
              — {s.supports}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="limits" className="mt-14">
        <h2 id="limits" className="font-display text-3xl text-ivory-50">6. Limitations and sources</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-mist-300">
          {READING_LIMITATIONS.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <ul className="mt-6 space-y-2 text-sm text-mist-400">
          {READING_SOURCES.filter((s) => !s.id.startsWith("avakahada-")).map((s) => (
            <li key={s.id}>
              {s.url ? (
                <a href={s.url} className="text-gold-300 underline underline-offset-4 hover:text-gold-200" rel="noreferrer noopener" target="_blank">
                  {s.label}
                </a>
              ) : (
                s.label
              )}{" "}
              — {s.note}
            </li>
          ))}
        </ul>
      </section>
    </Container>
  );
}
